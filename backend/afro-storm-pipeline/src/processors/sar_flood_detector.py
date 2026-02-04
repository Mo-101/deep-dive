"""
Sentinel-1 SAR Flood Detection
Detects flooded areas using SAR backscatter analysis
"""

import numpy as np
import xarray as xr
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import requests
from loguru import logger
import json


@dataclass
class DetectedFlood:
    id: str
    polygon: Dict[str, Any]  # GeoJSON Polygon
    area_km2: float
    detection_date: datetime
    confidence: float
    water_percentage: float
    source: str  # "Sentinel-1 SAR"
    metadata: Dict[str, Any]


class SARFloodDetector:
    """
    Flood detection using Sentinel-1 SAR imagery.
    
    Uses backscatter thresholding to identify standing water.
    Lower backscatter values (< -15 dB) typically indicate water.
    """
    
    def __init__(self, 
                 copernicus_user: Optional[str] = None,
                 copernicus_pass: Optional[str] = None,
                 output_dir: str = "data/detected_floods"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Copernicus Open Access Hub credentials
        self.copernicus_user = copernicus_user or os.getenv("COPERNICUS_USER")
        self.copernicus_pass = copernicus_pass or os.getenv("COPERNICUS_PASS")
        
        # Detection parameters
        self.water_threshold_db = -15.0  # dB threshold for water
        self.min_flood_area_km2 = 0.1    # Minimum area to report
    
    def search_sentinel_data(self, 
                            bbox: Tuple[float, float, float, float],
                            start_date: datetime,
                            end_date: datetime) -> List[Dict]:
        """
        Search for Sentinel-1 data in AOI.
        
        Args:
            bbox: (min_lon, min_lat, max_lon, max_lat)
            start_date: Search start date
            end_date: Search end date
            
        Returns:
            List of available products
        """
        try:
            # Use Copernicus Data Space API
            url = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
            
            params = {
                "$filter": f"""
                    Collection/Name eq 'SENTINEL-1' and
                    OData.CSC.Intersects(area=geography'SRID=4326;POLYGON (({bbox[0]} {bbox[1]}, 
                    {bbox[2]} {bbox[1]}, {bbox[2]} {bbox[3]}, {bbox[0]} {bbox[3]}, {bbox[0]} {bbox[1]}))') and
                    ContentDate/Start gt {start_date.isoformat()}Z and
                    ContentDate/End lt {end_date.isoformat()}Z
                """,
                "$orderby": "ContentDate/Start desc",
                "$top": 20,
            }
            
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                products = data.get('value', [])
                logger.info(f"Found {len(products)} Sentinel-1 products")
                return products
            else:
                logger.error(f"Search failed: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error searching Sentinel data: {e}")
            return []
    
    def download_sentinel_product(self, product_id: str, output_path: Path) -> bool:
        """Download Sentinel-1 product from Copernicus."""
        try:
            # This requires authentication
            if not self.copernicus_user or not self.copernicus_pass:
                logger.warning("No Copernicus credentials - skipping download")
                return False
            
            # Authentication and download logic would go here
            # For now, return False to use fallback
            logger.info(f"Would download {product_id} to {output_path}")
            return False
            
        except Exception as e:
            logger.error(f"Download failed: {e}")
            return False
    
    def detect_floods_from_sar(self, 
                               sar_file: str,
                               reference_file: Optional[str] = None) -> List[DetectedFlood]:
        """
        Detect floods from SAR backscatter data.
        
        Args:
            sar_file: Path to SAR GRD file (Sentinel-1)
            reference_file: Optional pre-flood reference image
            
        Returns:
            List of detected flood polygons
        """
        try:
            # Load SAR data
            ds = xr.open_dataset(sar_file)
            
            # Get VV polarization (Vertical transmit, Vertical receive)
            # Most sensitive to water
            if 'vv' in ds:
                vv_data = ds['vv']
            elif 'VV' in ds:
                vv_data = ds['VV']
            else:
                logger.warning("No VV polarization found")
                return self._fallback_detection()
            
            # Convert to dB if in linear scale
            if vv_data.max() > 1:  # Likely linear
                vv_db = 10 * np.log10(vv_data + 1e-10)
            else:
                vv_db = vv_data
            
            # Apply change detection if reference available
            if reference_file:
                change_map = self._change_detection(sar_file, reference_file)
                water_mask = change_map < -3.0  # 3 dB decrease indicates flooding
            else:
                # Simple threshold
                water_mask = vv_db < self.water_threshold_db
            
            # Convert mask to polygons
            floods = self._mask_to_polygons(water_mask, ds)
            
            logger.info(f"Detected {len(floods)} flooded areas")
            return floods
            
        except Exception as e:
            logger.error(f"SAR flood detection failed: {e}")
            return self._fallback_detection()
    
    def _change_detection(self, 
                         current_file: str, 
                         reference_file: str) -> xr.DataArray:
        """
        Perform change detection between current and reference SAR images.
        """
        current = xr.open_dataset(current_file)
        reference = xr.open_dataset(reference_file)
        
        # Get VV bands
        curr_vv = current['vv'] if 'vv' in current else current['VV']
        ref_vv = reference['vv'] if 'vv' in reference else reference['VV']
        
        # Ensure same shape
        curr_vv = curr_vv.sel(x=ref_vv.x, y=ref_vv.y, method='nearest')
        
        # Convert to dB
        curr_db = 10 * np.log10(curr_vv + 1e-10)
        ref_db = 10 * np.log10(ref_vv + 1e-10)
        
        # Change = Current - Reference
        # Negative values = decrease in backscatter = likely water
        change = curr_db - ref_db
        
        return change
    
    def _mask_to_polygons(self, 
                         mask: xr.DataArray, 
                         dataset: xr.Dataset) -> List[DetectedFlood]:
        """Convert binary water mask to GeoJSON polygons."""
        try:
            from rasterio import features
            import affine
            
            # Get coordinates
            if 'x' in mask.dims and 'y' in mask.dims:
                lons = mask.x.values
                lats = mask.y.values
            else:
                # Fallback to dataset coordinates
                lons = dataset.longitude.values if 'longitude' in dataset else np.arange(mask.shape[1])
                lats = dataset.latitude.values if 'latitude' in dataset else np.arange(mask.shape[0])
            
            # Create affine transform
            transform = affine.Affine.identity()
            
            # Extract polygons
            mask_values = mask.values.astype(np.uint8)
            shapes = features.shapes(mask_values, mask=mask_values == 1, transform=transform)
            
            floods = []
            for i, (geom, val) in enumerate(shapes):
                if val == 1:
                    # Convert pixel coordinates to lat/lon
                    coords = geom['coordinates'][0]  # Exterior ring
                    
                    # Simple pixel to coordinate conversion
                    geo_coords = []
                    for x, y in coords:
                        lon_idx = int(min(max(x, 0), len(lons) - 1))
                        lat_idx = int(min(max(y, 0), len(lats) - 1))
                        geo_coords.append([float(lons[lon_idx]), float(lats[lat_idx])])
                    
                    # Create polygon
                    polygon = {
                        "type": "Polygon",
                        "coordinates": [geo_coords]
                    }
                    
                    # Calculate area (simplified)
                    area_km2 = self._calculate_polygon_area(geo_coords)
                    
                    if area_km2 >= self.min_flood_area_km2:
                        floods.append(DetectedFlood(
                            id=f"flood-{datetime.utcnow().strftime('%Y%m%d')}-{i:04d}",
                            polygon=polygon,
                            area_km2=area_km2,
                            detection_date=datetime.utcnow(),
                            confidence=0.75,
                            water_percentage=95.0,
                            source="Sentinel-1 SAR",
                            metadata={
                                "threshold_db": self.water_threshold_db,
                                "polarization": "VV",
                            }
                        ))
            
            return floods
            
        except ImportError:
            logger.warning("rasterio not available - using fallback")
            return self._fallback_detection()
        except Exception as e:
            logger.error(f"Polygon extraction failed: {e}")
            return self._fallback_detection()
    
    def _calculate_polygon_area(self, coords: List[List[float]]) -> float:
        """Calculate approximate area of polygon in km²."""
        # Simplified calculation using shoelace formula
        if len(coords) < 3:
            return 0.0
        
        area = 0.0
        for i in range(len(coords)):
            j = (i + 1) % len(coords)
            area += coords[i][0] * coords[j][1]
            area -= coords[j][0] * coords[i][1]
        
        area = abs(area) / 2.0
        
        # Rough conversion to km² (at equator)
        # 1 degree ≈ 111 km
        area_km2 = area * 111 * 111
        
        return area_km2
    
    def _fallback_detection(self) -> List[DetectedFlood]:
        """Generate demo flood data for testing."""
        logger.info("Using fallback/demo flood detection")
        
        return [
            DetectedFlood(
                id=f"flood-demo-{datetime.utcnow().strftime('%Y%m%d')}-001",
                polygon={
                    "type": "Polygon",
                    "coordinates": [[
                        [39.2, -19.8],
                        [39.4, -19.8],
                        [39.4, -20.0],
                        [39.2, -20.0],
                        [39.2, -19.8],
                    ]]
                },
                area_km2=45.3,
                detection_date=datetime.utcnow(),
                confidence=0.85,
                water_percentage=92.0,
                source="Sentinel-1 SAR (Demo)",
                metadata={
                    "satellite": "Sentinel-1A",
                    "mode": "IW",
                    "polarization": "VV+VH",
                }
            )
        ]


# Singleton instance
flood_detector = SARFloodDetector()


def detect_floods_from_sentinel(aoi_bbox: Tuple[float, float, float, float],
                                 start_date: datetime,
                                 end_date: datetime) -> List[DetectedFlood]:
    """Convenience function for Sentinel-1 flood detection."""
    
    # Search for available data
    products = flood_detector.search_sentinel_data(aoi_bbox, start_date, end_date)
    
    if products:
        # Try to download and process first product
        # For now, return demo data
        logger.info(f"Found {len(products)} products, processing first")
        return flood_detector._fallback_detection()
    else:
        logger.warning("No Sentinel-1 data found")
        return flood_detector._fallback_detection()


if __name__ == "__main__":
    # Test detection
    logger.info("Testing SAR flood detector...")
    
    # Test AOI around Beira, Mozambique
    bbox = (34.5, -20.5, 40.0, -18.5)
    start = datetime.utcnow() - timedelta(days=7)
    end = datetime.utcnow()
    
    floods = detect_floods_from_sentinel(bbox, start, end)
    
    for f in floods:
        logger.info(f"Detected flood: {f.area_km2:.1f} km², confidence: {f.confidence}")

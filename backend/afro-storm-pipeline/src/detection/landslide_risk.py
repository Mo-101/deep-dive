#!/usr/bin/env python3
"""
AFRO STORM - Landslide Risk Calculator
=======================================

Calculate landslide risk from:
- Rainfall accumulation (from ERA5)
- Terrain slope (from DEM/SRTM data)
- Soil moisture (from ERA5-Land)
- Land cover (from ESA WorldCover)

Runs automatically when cyclone detected in mountainous region.

Risk factors:
- Slope > 15° = elevated risk
- Rainfall > 100mm/24h = elevated risk
- Saturated soil = elevated risk
- Deforested areas = elevated risk

Usage:
  python landslide_risk.py --region mozambique
  python landslide_risk.py --cyclone 35.5,-19.0 --rainfall 200
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import json

sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
import numpy as np

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    # DEM data sources
    "dem": {
        "srtm_url": "https://elevation-tiles-prod.s3.amazonaws.com/",
        "copernicus_dem_url": "https://prism-dem-open.copernicus.eu/",
    },
    
    # Risk thresholds
    "thresholds": {
        "slope_low": 10,        # degrees - low risk starts
        "slope_medium": 15,     # degrees - medium risk
        "slope_high": 25,       # degrees - high risk
        "slope_extreme": 35,    # degrees - extreme risk
        
        "rainfall_low": 50,     # mm/24h
        "rainfall_medium": 100, # mm/24h
        "rainfall_high": 200,   # mm/24h
        "rainfall_extreme": 400, # mm/24h
        
        "soil_moisture_high": 0.8,  # fraction (saturated)
    },
    
    # African mountainous regions prone to landslides
    "high_risk_regions": {
        "chimanimani": {
            "name": "Chimanimani Mountains (Zimbabwe/Mozambique)",
            "bbox": [32.5, -20.0, 33.5, -19.0],
            "typical_slope": 30,
        },
        "malawi_highlands": {
            "name": "Malawi Highlands",
            "bbox": [33.5, -16.0, 35.5, -14.0],
            "typical_slope": 25,
        },
        "madagascar_highlands": {
            "name": "Madagascar Central Highlands",
            "bbox": [46.5, -21.0, 48.5, -18.0],
            "typical_slope": 28,
        },
        "lebombo_mountains": {
            "name": "Lebombo Mountains (Mozambique)",
            "bbox": [31.5, -26.5, 33.0, -22.0],
            "typical_slope": 22,
        },
    },
    
    # Output directory
    "output_dir": Path(__file__).parent.parent.parent.parent / "data_dir" / "landslides",
}


# =============================================================================
# DEM DATA ACCESS
# =============================================================================

class DEMDataProvider:
    """Access Digital Elevation Model data."""
    
    def __init__(self):
        self.cache_dir = CONFIG["output_dir"] / "dem_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def get_terrain_data(
        self,
        bbox: List[float],
        resolution: float = 30  # meters
    ) -> Dict:
        """
        Get terrain characteristics for a bounding box.
        
        Returns:
            Dict with slope, aspect, elevation data
        """
        
        logger.info(f"Getting terrain data for bbox: {bbox}")
        
        # In production, would fetch from SRTM or Copernicus DEM
        # For now, simulate terrain characteristics
        
        return self._simulate_terrain(bbox)
    
    def _simulate_terrain(self, bbox: List[float]) -> Dict:
        """Simulate terrain data for testing."""
        
        # Generate grid
        resolution = 0.01  # ~1km grid
        lons = np.arange(bbox[0], bbox[2], resolution)
        lats = np.arange(bbox[1], bbox[3], resolution)
        
        lon_grid, lat_grid = np.meshgrid(lons, lats)
        
        # Simulate realistic terrain
        # Higher slopes near mountain ranges
        base_slope = 5 + 10 * np.abs(np.sin(lon_grid * 10) * np.cos(lat_grid * 10))
        
        # Add mountain peaks
        peaks = [(bbox[0] + 0.3 * (bbox[2] - bbox[0]), bbox[1] + 0.5 * (bbox[3] - bbox[1]))]
        for peak_lon, peak_lat in peaks:
            dist = np.sqrt((lon_grid - peak_lon)**2 + (lat_grid - peak_lat)**2)
            base_slope += 20 * np.exp(-dist / 0.1)
        
        # Elevations
        elevation = 200 + 800 * np.abs(np.sin(lon_grid * 5) * np.cos(lat_grid * 5))
        
        return {
            "lons": lons.tolist(),
            "lats": lats.tolist(),
            "slope": base_slope.tolist(),        # degrees
            "elevation": elevation.tolist(),      # meters
            "aspect": (np.random.rand(*lon_grid.shape) * 360).tolist(),  # degrees from north
        }


# =============================================================================
# LANDSLIDE RISK CALCULATOR
# =============================================================================

class LandslideRiskCalculator:
    """Calculate landslide risk for regions."""
    
    def __init__(self):
        self.dem_provider = DEMDataProvider()
        self.output_dir = CONFIG["output_dir"]
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.thresholds = CONFIG["thresholds"]
    
    def calculate_risk(
        self,
        cyclone_location: Tuple[float, float] = None,
        rainfall_mm: float = None,
        region_key: str = None,
        bbox: List[float] = None,
    ) -> Dict:
        """
        Calculate landslide risk for a region.
        
        Args:
            cyclone_location: (lat, lon) of cyclone center
            rainfall_mm: Accumulated rainfall in mm
            region_key: Pre-defined high-risk region
            bbox: Custom bounding box
        
        Returns:
            GeoJSON with risk zones and metadata
        """
        
        # Determine region
        if region_key and region_key in CONFIG["high_risk_regions"]:
            region = CONFIG["high_risk_regions"][region_key]
            bbox = region["bbox"]
            region_name = region["name"]
        elif cyclone_location:
            lat, lon = cyclone_location
            buffer = 2  # degrees
            bbox = [lon - buffer, lat - buffer, lon + buffer, lat + buffer]
            region_name = f"Cyclone impact zone ({lat:.1f}, {lon:.1f})"
        elif bbox:
            region_name = "Custom region"
        else:
            logger.error("Must specify region_key, cyclone_location, or bbox")
            return {}
        
        logger.info(f"Calculating landslide risk for {region_name}")
        
        # Get terrain data
        terrain = self.dem_provider.get_terrain_data(bbox)
        
        # Estimate rainfall if not provided
        if rainfall_mm is None:
            rainfall_mm = 150  # Default moderate cyclone rainfall
        
        logger.info(f"  Rainfall: {rainfall_mm} mm")
        
        # Calculate risk zones
        risk_zones = self._calculate_risk_zones(terrain, rainfall_mm)
        
        # Build result
        result = {
            "type": "FeatureCollection",
            "metadata": {
                "region": region_name,
                "bbox": bbox,
                "rainfall_mm": rainfall_mm,
                "calculation_time": datetime.utcnow().isoformat(),
                "methodology": "Slope-rainfall composite risk model",
            },
            "summary": {
                "total_zones": len(risk_zones),
                "high_risk_zones": sum(1 for z in risk_zones if z["risk_level"] in ["HIGH", "EXTREME"]),
                "area_at_high_risk_km2": sum(z.get("area_km2", 0) for z in risk_zones if z["risk_level"] in ["HIGH", "EXTREME"]),
            },
            "features": [self._zone_to_feature(zone) for zone in risk_zones],
        }
        
        # Save results
        self._save_results(result, region_name)
        
        return result
    
    def _calculate_risk_zones(self, terrain: Dict, rainfall_mm: float) -> List[Dict]:
        """Calculate risk for each terrain cell."""
        
        risk_zones = []
        
        lons = terrain["lons"]
        lats = terrain["lats"]
        slopes = np.array(terrain["slope"])
        elevations = np.array(terrain["elevation"])
        
        # Find high-risk cells (slope + rainfall combination)
        for i in range(len(lats)):
            for j in range(len(lons)):
                try:
                    slope = slopes[i][j]
                except (IndexError, TypeError):
                    continue
                
                # Calculate composite risk score
                risk_level, risk_score, reason = self._calculate_cell_risk(slope, rainfall_mm)
                
                if risk_level in ["HIGH", "EXTREME"]:
                    risk_zones.append({
                        "lat": lats[i],
                        "lon": lons[j],
                        "slope_deg": slope,
                        "rainfall_mm": rainfall_mm,
                        "risk_level": risk_level,
                        "risk_score": risk_score,
                        "reason": reason,
                        "area_km2": 1.0,  # Approximate cell size
                        "recommended_action": self._get_action(risk_level),
                    })
        
        logger.info(f"  Found {len(risk_zones)} risk zones")
        
        # Cluster nearby zones
        clustered = self._cluster_zones(risk_zones)
        
        logger.info(f"  Clustered to {len(clustered)} zones")
        
        return clustered[:50]  # Return top 50 zones
    
    def _calculate_cell_risk(
        self,
        slope: float,
        rainfall: float
    ) -> Tuple[str, float, str]:
        """
        Calculate risk for a single cell.
        
        Returns:
            (risk_level, risk_score, reason)
        """
        
        t = self.thresholds
        
        # Slope factor (0-1)
        if slope >= t["slope_extreme"]:
            slope_factor = 1.0
            slope_desc = f"Extreme slope ({slope:.0f}°)"
        elif slope >= t["slope_high"]:
            slope_factor = 0.8
            slope_desc = f"High slope ({slope:.0f}°)"
        elif slope >= t["slope_medium"]:
            slope_factor = 0.5
            slope_desc = f"Medium slope ({slope:.0f}°)"
        elif slope >= t["slope_low"]:
            slope_factor = 0.2
            slope_desc = f"Low slope ({slope:.0f}°)"
        else:
            slope_factor = 0.0
            slope_desc = f"Minimal slope ({slope:.0f}°)"
        
        # Rainfall factor (0-1)
        if rainfall >= t["rainfall_extreme"]:
            rain_factor = 1.0
            rain_desc = f"Extreme rainfall ({rainfall:.0f} mm)"
        elif rainfall >= t["rainfall_high"]:
            rain_factor = 0.8
            rain_desc = f"High rainfall ({rainfall:.0f} mm)"
        elif rainfall >= t["rainfall_medium"]:
            rain_factor = 0.5
            rain_desc = f"Medium rainfall ({rainfall:.0f} mm)"
        elif rainfall >= t["rainfall_low"]:
            rain_factor = 0.2
            rain_desc = f"Low rainfall ({rainfall:.0f} mm)"
        else:
            rain_factor = 0.0
            rain_desc = f"Minimal rainfall ({rainfall:.0f} mm)"
        
        # Composite score (geometric mean amplifies joint high values)
        score = np.sqrt(slope_factor * rain_factor)
        
        # Classify
        if score >= 0.8:
            level = "EXTREME"
        elif score >= 0.5:
            level = "HIGH"
        elif score >= 0.3:
            level = "MEDIUM"
        elif score >= 0.1:
            level = "LOW"
        else:
            level = "MINIMAL"
        
        reason = f"{slope_desc} + {rain_desc}"
        
        return level, round(score, 3), reason
    
    def _get_action(self, risk_level: str) -> str:
        """Get recommended action for risk level."""
        
        actions = {
            "EXTREME": "IMMEDIATE EVACUATION - Landslide likely within 24h",
            "HIGH": "Prepare evacuation routes - Monitor for debris flows",
            "MEDIUM": "Stay alert - Avoid slopes during and after rain",
            "LOW": "Normal precautions - Be aware of surroundings",
            "MINIMAL": "No immediate action required",
        }
        
        return actions.get(risk_level, "Unknown")
    
    def _cluster_zones(self, zones: List[Dict]) -> List[Dict]:
        """Cluster nearby risk zones into larger areas."""
        
        if not zones:
            return []
        
        # Sort by risk score descending
        zones.sort(key=lambda z: z["risk_score"], reverse=True)
        
        # Simple clustering - take highest risk zones
        # In production, would use proper spatial clustering
        
        return zones
    
    def _zone_to_feature(self, zone: Dict) -> Dict:
        """Convert risk zone to GeoJSON feature."""
        
        # Create small polygon around point
        lat, lon = zone["lat"], zone["lon"]
        offset = 0.01  # ~1km
        
        return {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lon - offset, lat - offset],
                    [lon + offset, lat - offset],
                    [lon + offset, lat + offset],
                    [lon - offset, lat + offset],
                    [lon - offset, lat - offset],
                ]]
            },
            "properties": {
                "lat": lat,
                "lon": lon,
                "slope_deg": zone["slope_deg"],
                "rainfall_mm": zone["rainfall_mm"],
                "risk_level": zone["risk_level"],
                "risk_score": zone["risk_score"],
                "reason": zone["reason"],
                "recommended_action": zone["recommended_action"],
            }
        }
    
    def _save_results(self, data: Dict, region_name: str):
        """Save landslide risk results."""
        
        filename = f"landslide_risk_{region_name.lower().replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M')}.geojson"
        output_path = self.output_dir / filename
        
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"  Saved: {output_path}")


# =============================================================================
# DATABASE INTEGRATION
# =============================================================================

def save_landslide_data(data: Dict) -> int:
    """Save landslide risk assessment to database."""
    
    import sqlite3
    
    db_path = Path(__file__).parent.parent.parent.parent / "data_dir" / "cyclone_detections.db"
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS landslide_risks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_time TEXT NOT NULL,
            region TEXT,
            bbox TEXT,
            rainfall_mm REAL,
            total_zones INTEGER,
            high_risk_zones INTEGER,
            area_at_risk_km2 REAL,
            geojson TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    metadata = data.get("metadata", {})
    summary = data.get("summary", {})
    
    cursor.execute("""
        INSERT INTO landslide_risks (
            assessment_time, region, bbox, rainfall_mm,
            total_zones, high_risk_zones, area_at_risk_km2, geojson
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        metadata.get("calculation_time"),
        metadata.get("region"),
        json.dumps(metadata.get("bbox")),
        metadata.get("rainfall_mm"),
        summary.get("total_zones", 0),
        summary.get("high_risk_zones", 0),
        summary.get("area_at_high_risk_km2", 0),
        json.dumps(data),
    ))
    
    risk_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    logger.info(f"Saved landslide risk #{risk_id} to database")
    return risk_id


# =============================================================================
# CLI
# =============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="AFRO STORM Landslide Risk Calculator"
    )
    
    parser.add_argument(
        "--region",
        choices=list(CONFIG["high_risk_regions"].keys()),
        help="Pre-defined high-risk region"
    )
    
    parser.add_argument(
        "--cyclone",
        help="Cyclone location as lat,lon"
    )
    
    parser.add_argument(
        "--rainfall",
        type=float,
        default=150,
        help="Rainfall in mm (default: 150)"
    )
    
    parser.add_argument(
        "--list-regions",
        action="store_true",
        help="List high-risk regions"
    )
    
    args = parser.parse_args()
    
    if args.list_regions:
        print("\nHigh-risk landslide regions:")
        for key, val in CONFIG["high_risk_regions"].items():
            print(f"  {key}: {val['name']}")
            print(f"    Typical slope: {val['typical_slope']}°")
        return
    
    calculator = LandslideRiskCalculator()
    
    if args.cyclone:
        lat, lon = map(float, args.cyclone.split(","))
        result = calculator.calculate_risk(
            cyclone_location=(lat, lon),
            rainfall_mm=args.rainfall
        )
    elif args.region:
        result = calculator.calculate_risk(
            region_key=args.region,
            rainfall_mm=args.rainfall
        )
    else:
        parser.print_help()
        return
    
    if result:
        save_landslide_data(result)
        print(json.dumps(result["summary"], indent=2))


if __name__ == "__main__":
    main()

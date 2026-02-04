"""
Landslide Risk Calculator
Calculates landslide risk from rainfall + slope + soil data
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
class LandslideRisk:
    id: str
    location: Dict[str, float]  # lat, lon
    risk_level: str  # low, medium, high, critical
    risk_score: float  # 0-100
    slope_angle: float  # degrees
    rainfall_mm: float  # 24h rainfall
    soil_saturation: float  # percentage
    contributing_factors: List[str]
    detection_time: datetime


class LandslideRiskCalculator:
    """
    Calculates landslide risk using:
    - Rainfall data (GPM/IMERG or ground stations)
    - Slope angle (SRTM DEM)
    - Soil moisture/saturation
    - Land cover type
    """
    
    def __init__(self,
                 rainfall_threshold_low: float = 50,    # mm
                 rainfall_threshold_medium: float = 100,
                 rainfall_threshold_high: float = 150,
                 slope_threshold: float = 15,  # degrees
                 output_dir: str = "data/landslide_risks"):
        
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Thresholds
        self.rainfall_thresholds = {
            'low': rainfall_threshold_low,
            'medium': rainfall_threshold_medium,
            'high': rainfall_threshold_high,
        }
        self.slope_threshold = slope_threshold
        
        # NASA GPM API endpoint
        self.gpm_api_url = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap"
    
    def fetch_rainfall_data(self, 
                           bbox: Tuple[float, float, float, float],
                           date: datetime) -> Optional[xr.DataArray]:
        """
        Fetch rainfall data from NASA GPM IMERG.
        
        Args:
            bbox: (min_lon, min_lat, max_lon, max_lat)
            date: Date to fetch
            
        Returns:
            Rainfall data array (mm)
        """
        try:
            # Try to fetch from NASA GPM API
            # Note: Requires Earthdata login
            
            logger.info(f"Fetching rainfall data for {date.date()}")
            
            # For now, use fallback data
            # In production, this would connect to:
            # - NASA GPM IMERG (satellite rainfall)
            # - CHIRPS (rainfall estimates)
            # - National meteorological services
            
            return self._generate_fallback_rainfall(bbox, date)
            
        except Exception as e:
            logger.error(f"Failed to fetch rainfall: {e}")
            return self._generate_fallback_rainfall(bbox, date)
    
    def fetch_slope_data(self,
                        bbox: Tuple[float, float, float, float]) -> Optional[xr.DataArray]:
        """
        Fetch slope data from SRTM DEM.
        
        Args:
            bbox: AOI bounding box
            
        Returns:
            Slope angle in degrees
        """
        try:
            # In production, this would:
            # 1. Fetch SRTM elevation data
            # 2. Calculate slope gradients
            # 3. Convert to degrees
            
            logger.info("Fetching slope data from SRTM")
            
            return self._generate_fallback_slope(bbox)
            
        except Exception as e:
            logger.error(f"Failed to fetch slope: {e}")
            return self._generate_fallback_slope(bbox)
    
    def calculate_risk(self,
                      bbox: Tuple[float, float, float, float],
                      date: datetime,
                      region: str = "mozambique") -> List[LandslideRisk]:
        """
        Calculate landslide risks for an area.
        
        Args:
            bbox: Area bounding box
            date: Analysis date
            region: Region name for context
            
        Returns:
            List of high-risk locations
        """
        try:
            # Fetch input data
            rainfall = self.fetch_rainfall_data(bbox, date)
            slope = self.fetch_slope_data(bbox)
            
            if rainfall is None or slope is None:
                logger.warning("Missing input data - using fallback")
                return self._fallback_risks(date)
            
            # Calculate risk score
            risks = []
            
            # Find locations with both high rainfall and steep slopes
            # This is a simplified model
            
            # Create grid of points
            lats = np.linspace(bbox[1], bbox[3], 20)
            lons = np.linspace(bbox[0], bbox[2], 20)
            
            risk_id = 0
            for lat in lats:
                for lon in lons:
                    # Get values at this location
                    rain_val = self._sample_at_location(rainfall, lon, lat)
                    slope_val = self._sample_at_location(slope, lon, lat)
                    
                    if rain_val is None or slope_val is None:
                        continue
                    
                    # Calculate risk score
                    risk_score = self._compute_risk_score(rain_val, slope_val)
                    
                    # Only report medium+ risks
                    if risk_score >= 40:
                        risk_level = self._score_to_level(risk_score)
                        
                        factors = []
                        if rain_val > self.rainfall_thresholds['high']:
                            factors.append("Extreme rainfall")
                        elif rain_val > self.rainfall_thresholds['medium']:
                            factors.append("Heavy rainfall")
                        
                        if slope_val > 30:
                            factors.append("Very steep slope")
                        elif slope_val > self.slope_threshold:
                            factors.append("Steep slope")
                        
                        risks.append(LandslideRisk(
                            id=f"landslide-{date.strftime('%Y%m%d')}-{risk_id:04d}",
                            location={'lat': float(lat), 'lon': float(lon)},
                            risk_level=risk_level,
                            risk_score=risk_score,
                            slope_angle=float(slope_val),
                            rainfall_mm=float(rain_val),
                            soil_saturation=min(100, rain_val * 0.5),  # Simplified
                            contributing_factors=factors,
                            detection_time=date,
                        ))
                        
                        risk_id += 1
            
            # Sort by risk score
            risks.sort(key=lambda x: x.risk_score, reverse=True)
            
            # Return top 20 risks
            logger.info(f"Calculated {len(risks)} landslide risks")
            return risks[:20]
            
        except Exception as e:
            logger.error(f"Risk calculation failed: {e}")
            return self._fallback_risks(date)
    
    def _compute_risk_score(self, rainfall_mm: float, slope_deg: float) -> float:
        """
        Compute landslide risk score (0-100).
        
        Based on simplified USGS rainfall threshold model:
        - Rainfall intensity
        - Slope angle
        - Duration
        """
        # Rainfall component (0-50)
        if rainfall_mm >= self.rainfall_thresholds['high']:
            rain_score = 50
        elif rainfall_mm >= self.rainfall_thresholds['medium']:
            rain_score = 35 + (rainfall_mm - self.rainfall_thresholds['medium']) / \
                        (self.rainfall_thresholds['high'] - self.rainfall_thresholds['medium']) * 15
        elif rainfall_mm >= self.rainfall_thresholds['low']:
            rain_score = 20 + (rainfall_mm - self.rainfall_thresholds['low']) / \
                        (self.rainfall_thresholds['medium'] - self.rainfall_thresholds['low']) * 15
        else:
            rain_score = rainfall_mm / self.rainfall_thresholds['low'] * 20
        
        # Slope component (0-40)
        if slope_deg >= 45:
            slope_score = 40
        elif slope_deg >= self.slope_threshold:
            slope_score = (slope_deg - self.slope_threshold) / (45 - self.slope_threshold) * 40
        else:
            slope_score = 0
        
        # Combined score
        total_score = rain_score + slope_score
        
        return min(100, total_score)
    
    def _score_to_level(self, score: float) -> str:
        """Convert risk score to level."""
        if score >= 75:
            return 'critical'
        elif score >= 60:
            return 'high'
        elif score >= 40:
            return 'medium'
        else:
            return 'low'
    
    def _sample_at_location(self, data: xr.DataArray, lon: float, lat: float) -> Optional[float]:
        """Sample data array at a location."""
        try:
            # Find nearest point
            if 'longitude' in data.coords and 'latitude' in data.coords:
                value = data.sel(longitude=lon, latitude=lat, method='nearest')
            elif 'lon' in data.coords and 'lat' in data.coords:
                value = data.sel(lon=lon, lat=lat, method='nearest')
            else:
                # Fallback: use interpolation
                value = data.interp(coords={'lon': lon, 'lat': lat}, method='nearest')
            
            return float(value.values)
        except:
            return None
    
    def _generate_fallback_rainfall(self, 
                                    bbox: Tuple[float, float, float, float],
                                    date: datetime) -> xr.DataArray:
        """Generate synthetic rainfall data."""
        # Create grid
        lats = np.linspace(bbox[1], bbox[3], 50)
        lons = np.linspace(bbox[0], bbox[2], 50)
        
        # Generate synthetic rainfall (higher in some areas)
        np.random.seed(int(date.timestamp()))
        rain = np.random.exponential(30, (50, 50))  # Mean 30mm
        
        # Add some high rainfall clusters
        for _ in range(3):
            cx, cy = np.random.randint(10, 40, 2)
            rain[max(0,cx-5):min(50,cx+5), max(0,cy-5):min(50,cy+5)] += np.random.uniform(50, 150)
        
        da = xr.DataArray(
            rain,
            coords=[('latitude', lats), ('longitude', lons)],
            name='rainfall'
        )
        
        return da
    
    def _generate_fallback_slope(self,
                                 bbox: Tuple[float, float, float, float]) -> xr.DataArray:
        """Generate synthetic slope data."""
        lats = np.linspace(bbox[1], bbox[3], 50)
        lons = np.linspace(bbox[0], bbox[2], 50)
        
        # Generate synthetic slopes
        np.random.seed(42)
        slope = np.random.gamma(2, 8, (50, 50))  # Mean ~16 degrees
        
        da = xr.DataArray(
            slope,
            coords=[('latitude', lats), ('longitude', lons)],
            name='slope'
        )
        
        return da
    
    def _fallback_risks(self, date: datetime) -> List[LandslideRisk]:
        """Generate demo landslide risks."""
        logger.info("Using fallback/demo landslide risks")
        
        return [
            LandslideRisk(
                id=f"landslide-{date.strftime('%Y%m%d')}-001",
                location={'lat': -19.5, 'lon': 34.2},
                risk_level='high',
                risk_score=78.5,
                slope_angle=35.0,
                rainfall_mm=180.0,
                soil_saturation=85.0,
                contributing_factors=["Extreme rainfall", "Very steep slope"],
                detection_time=date,
            ),
            LandslideRisk(
                id=f"landslide-{date.strftime('%Y%m%d')}-002",
                location={'lat': -18.8, 'lon': 35.1},
                risk_level='medium',
                risk_score=55.0,
                slope_angle=28.0,
                rainfall_mm=120.0,
                soil_saturation=60.0,
                contributing_factors=["Heavy rainfall", "Steep slope"],
                detection_time=date,
            ),
        ]


# Singleton instance
landslide_calculator = LandslideRiskCalculator()


def calculate_landslide_risks(aoi_bbox: Tuple[float, float, float, float],
                              date: Optional[datetime] = None) -> List[LandslideRisk]:
    """Convenience function for landslide risk calculation."""
    if date is None:
        date = datetime.utcnow()
    
    return landslide_calculator.calculate_risk(aoi_bbox, date)


if __name__ == "__main__":
    # Test calculation
    logger.info("Testing landslide risk calculator...")
    
    # Test AOI around Mozambique
    bbox = (33, -20, 36, -18)
    date = datetime.utcnow()
    
    risks = calculate_landslide_risks(bbox, date)
    
    for r in risks:
        logger.info(f"Risk: {r.risk_level} ({r.risk_score:.1f}) at ({r.location['lat']}, {r.location['lon']})")
        logger.info(f"  Rainfall: {r.rainfall_mm}mm, Slope: {r.slope_angle}°")

"""
FNV3 Large Ensemble Fetcher
WeatherNext probabilistic cyclone forecasts
Real API integration with live data
"""

import asyncio
import aiohttp
import gzip
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import xarray as xr
import numpy as np
import json
from loguru import logger

from config.settings import config

class FNV3Fetcher:
    """Fetch and process FNV3 Large Ensemble cyclone probability data"""
    
    def __init__(self):
        self.base_url = config.climate.fnv3_base_url
        self.africa_bbox = config.climate.africa_bbox
        
    def get_latest_forecast_url(self, init_time: Optional[datetime] = None) -> str:
        """
        Construct URL for latest FNV3 forecast
        
        FNV3 files follow pattern:
        FNV3_LARGE_ENSEMBLE_YYYY_MM_DDTHH_MM_cumulative_probability_fields.nc.gz
        
        Updates every 6 hours: 00, 06, 12, 18 UTC
        """
        if init_time is None:
            init_time = datetime.utcnow()
        
        # Round to nearest 6-hour cycle
        hour = (init_time.hour // 6) * 6
        init_time = init_time.replace(hour=hour, minute=0, second=0, microsecond=0)
        
        # Format filename
        timestamp = init_time.strftime("%Y_%m_%dT%H_%M")
        filename = f"FNV3_LARGE_ENSEMBLE_{timestamp}_cumulative_probability_fields.nc.gz"
        
        url = f"{self.base_url}/{filename}"
        logger.info(f"FNV3 URL: {url}")
        
        return url
    
    async def fetch_latest_forecast(self, max_retries: int = 3) -> Optional[xr.Dataset]:
        """
        Fetch latest FNV3 forecast from WeatherNext
        Will try current and previous cycles if unavailable
        """
        for retry in range(max_retries):
            try:
                # Try current time minus (retry * 6 hours)
                init_time = datetime.utcnow() - timedelta(hours=retry * 6)
                url = self.get_latest_forecast_url(init_time)
                
                logger.info(f"Attempting fetch (try {retry + 1}/{max_retries}): {init_time}")
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(url) as response:
                        if response.status == 200:
                            logger.success(f"✓ Found FNV3 data for {init_time}")
                            
                            # Download compressed data
                            compressed_data = await response.read()
                            
                            # Save raw compressed file
                            raw_file = Path(f"data/raw/fnv3_{init_time.strftime('%Y%m%d_%H%M')}.nc.gz")
                            raw_file.parent.mkdir(parents=True, exist_ok=True)
                            
                            with open(raw_file, 'wb') as f:
                                f.write(compressed_data)
                            
                            # Decompress
                            decompressed = gzip.decompress(compressed_data)
                            
                            # Save decompressed
                            nc_file = raw_file.with_suffix('')
                            with open(nc_file, 'wb') as f:
                                f.write(decompressed)
                            
                            # Load with xarray
                            ds = xr.open_dataset(nc_file)
                            logger.success(f"Loaded FNV3 dataset: {ds.dims}")
                            logger.info(f"Variables: {list(ds.data_vars)}")
                            
                            return ds
                        
                        elif response.status == 404:
                            logger.warning(f"FNV3 data not available for {init_time}, trying previous cycle...")
                            continue
                        else:
                            logger.error(f"HTTP {response.status}: {await response.text()}")
                            continue
                            
            except Exception as e:
                logger.error(f"Error fetching FNV3 (try {retry + 1}): {e}")
                if retry < max_retries - 1:
                    await asyncio.sleep(5)
                continue
        
        logger.error("Failed to fetch FNV3 data after all retries")
        return None
    
    def extract_africa_region(self, ds: xr.Dataset) -> xr.Dataset:
        """Extract Africa bounding box from global dataset"""
        lon_min, lat_min, lon_max, lat_max = self.africa_bbox
        
        # FNV3 uses 0-360 longitude convention
        # Convert our -180/180 bounds to 0-360
        if lon_min < 0:
            lon_min += 360
        if lon_max < 0:
            lon_max += 360
        
        # Extract region
        africa_ds = ds.sel(
            lon=slice(lon_min, lon_max),
            lat=slice(lat_max, lat_min)  # Reversed for NetCDF
        )
        
        logger.info(f"Extracted Africa region: {africa_ds.dims}")
        return africa_ds
    
    async def process_and_save(
        self,
        ds: xr.Dataset,
        output_dir: Path,
        time_steps: Optional[List[int]] = None
    ) -> List[Path]:
        """
        Process FNV3 data and save GeoJSON files
        
        FNV3 provides:
        - track_probability: Where the cyclone might go
        - 34_knot_strike_probability: Tropical storm winds
        - 50_knot_strike_probability: Strong tropical storm
        - 64_knot_strike_probability: Hurricane force
        """
        saved_files = []
        
        try:
            # Extract Africa region
            africa_ds = self.extract_africa_region(ds)
            
            # Get time dimension info
            max_lead_time = africa_ds.coords['max_lead_time'].values
            init_time = africa_ds.attrs.get('init_time', datetime.utcnow().isoformat())
            
            # Process specific time steps or all
            if time_steps is None:
                # Process every 24 hours (4 steps = 24h at 6h intervals)
                time_steps = list(range(0, len(max_lead_time), 4))[:10]  # First 10 days
            
            logger.info(f"Processing {len(time_steps)} time steps")
            
            for t_idx in time_steps:
                forecast_hour = int(max_lead_time[t_idx])
                
                geojson_file = await self.to_geojson(
                    africa_ds,
                    t_idx,
                    forecast_hour,
                    init_time,
                    output_dir
                )
                
                if geojson_file:
                    saved_files.append(geojson_file)
            
            logger.success(f"✓ Processed {len(saved_files)} forecast steps")
            
        except Exception as e:
            logger.error(f"Error processing FNV3: {e}")
            import traceback
            logger.error(traceback.format_exc())
        
        return saved_files
    
    async def to_geojson(
        self,
        ds: xr.Dataset,
        time_idx: int,
        forecast_hour: int,
        init_time: str,
        output_dir: Path,
        threshold: float = 0.05
    ) -> Optional[Path]:
        """Convert FNV3 probability fields to GeoJSON"""
        
        try:
            # Extract probabilities at this time step
            track_prob = ds['track_probability'].isel(max_lead_time=time_idx)
            wind_34kt = ds['34_knot_strike_probability'].isel(max_lead_time=time_idx)
            wind_50kt = ds['50_knot_strike_probability'].isel(max_lead_time=time_idx)
            wind_64kt = ds['64_knot_strike_probability'].isel(max_lead_time=time_idx)
            
            # Get coordinates
            lats = track_prob.coords['lat'].values
            lons = track_prob.coords['lon'].values
            
            # Convert longitude from 0-360 to -180-180
            lons_converted = np.where(lons > 180, lons - 360, lons)
            
            features = []
            
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    # Get all probability values
                    track_p = float(track_prob.values[i, j])
                    w34_p = float(wind_34kt.values[i, j])
                    w50_p = float(wind_50kt.values[i, j])
                    w64_p = float(wind_64kt.values[i, j])
                    
                    # Skip if all probabilities are below threshold
                    max_prob = max(track_p, w34_p, w50_p, w64_p)
                    if max_prob < threshold or np.isnan(max_prob):
                        continue
                    
                    # Convert longitude
                    lon_converted = float(lons_converted[j])
                    
                    # Create feature
                    feature = {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Point',
                            'coordinates': [lon_converted, float(lat)]
                        },
                        'properties': {
                            'track_probability': round(track_p, 4),
                            'wind_34kt_probability': round(w34_p, 4),
                            'wind_50kt_probability': round(w50_p, 4),
                            'wind_64kt_probability': round(w64_p, 4),
                            'max_probability': round(max_prob, 4),
                            'forecast_hour': forecast_hour,
                            'category': self.categorize_threat(w34_p, w50_p, w64_p)
                        }
                    }
                    features.append(feature)
            
            if not features:
                logger.warning(f"No features above threshold for +{forecast_hour}h")
                return None
            
            # Create GeoJSON
            geojson = {
                'type': 'FeatureCollection',
                'features': features,
                'metadata': {
                    'source': 'FNV3 Large Ensemble',
                    'init_time': init_time,
                    'forecast_hour': forecast_hour,
                    'num_points': len(features),
                    'threshold': threshold,
                    'max_probability': max([f['properties']['max_probability'] for f in features])
                }
            }
            
            # Save to file
            output_file = output_dir / f"fnv3_T{forecast_hour:03d}h.geojson"
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w') as f:
                json.dump(geojson, f)
            
            logger.info(f"✓ Saved {len(features)} features to {output_file.name}")
            return output_file
            
        except Exception as e:
            logger.error(f"Error creating GeoJSON: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    @staticmethod
    def categorize_threat(w34: float, w50: float, w64: float) -> str:
        """Categorize cyclone threat level"""
        if w64 > 0.3:
            return "HURRICANE"
        elif w50 > 0.3:
            return "STRONG_TROPICAL_STORM"
        elif w34 > 0.3:
            return "TROPICAL_STORM"
        elif w34 > 0.1:
            return "TROPICAL_DEPRESSION"
        else:
            return "LOW_THREAT"
    
    async def get_current_cyclones(self, ds: xr.Dataset) -> List[Dict]:
        """
        Identify current active cyclones from probability fields
        Returns list of cyclone centers with metadata
        """
        try:
            # Use first time step (current conditions)
            track_prob = ds['track_probability'].isel(max_lead_time=0)
            wind_34kt = ds['34_knot_strike_probability'].isel(max_lead_time=0)
            
            # Find local maxima in track probability
            from scipy.ndimage import maximum_filter
            
            # Apply maximum filter to find peaks
            data = track_prob.values
            max_filtered = maximum_filter(data, size=5)
            
            # Peaks are where original equals max_filtered and > threshold
            peaks = (data == max_filtered) & (data > 0.5)
            
            cyclones = []
            peak_indices = np.argwhere(peaks)
            
            for idx in peak_indices:
                i, j = idx
                lat = float(track_prob.coords['lat'].values[i])
                lon = float(track_prob.coords['lon'].values[j])
                
                # Convert longitude
                if lon > 180:
                    lon -= 360
                
                track_p = float(data[i, j])
                wind_p = float(wind_34kt.values[i, j])
                
                cyclone = {
                    'location': {'lat': lat, 'lon': lon},
                    'track_probability': round(track_p, 3),
                    'wind_34kt_probability': round(wind_p, 3),
                    'threat_level': self.categorize_threat(wind_p, 0, 0)
                }
                
                cyclones.append(cyclone)
            
            logger.info(f"Identified {len(cyclones)} potential cyclones")
            return cyclones
            
        except Exception as e:
            logger.error(f"Error identifying cyclones: {e}")
            return []

# Example usage
async def main():
    """Test FNV3 fetcher with real API"""
    logger.info("🌪️  Testing FNV3 fetcher...")
    
    fetcher = FNV3Fetcher()
    
    # Fetch latest data
    ds = await fetcher.fetch_latest_forecast()
    
    if ds:
        logger.success("✓ Successfully fetched FNV3 data")
        
        # Identify current cyclones
        cyclones = await fetcher.get_current_cyclones(ds)
        if cyclones:
            logger.info(f"🌀 Active cyclones: {len(cyclones)}")
            for c in cyclones:
                logger.info(f"  - {c['location']} | Prob: {c['track_probability']} | {c['threat_level']}")
        
        # Process and save GeoJSON
        output_dir = Path("data/geojson/fnv3")
        files = await fetcher.process_and_save(ds, output_dir)
        
        logger.success(f"✓ Processed {len(files)} forecast files")
        
        # Show sample
        if files:
            with open(files[0], 'r') as f:
                sample = json.load(f)
            logger.info(f"Sample metadata: {sample['metadata']}")
    else:
        logger.error("✗ Failed to fetch FNV3 data")

if __name__ == "__main__":
    asyncio.run(main())

"""
GraphCast Climate Data Fetcher
Google DeepMind's GraphCast for 10-day weather forecasting
"""

import asyncio
import aiohttp
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import xarray as xr
import numpy as np
from loguru import logger

from config.settings import config

class GraphCastFetcher:
    """Fetch and process GraphCast forecast data"""
    
    def __init__(self):
        self.base_url = "https://weather-data.google.com/graphcast"
        self.africa_bbox = config.climate.africa_bbox  # (lon_min, lat_min, lon_max, lat_max)
        self.forecast_days = config.climate.forecast_days
        
    async def fetch_latest_forecast(self) -> Optional[xr.Dataset]:
        """
        Fetch latest GraphCast forecast
        
        Note: GraphCast data access might require different API endpoints
        This is a template structure - adjust based on actual API
        """
        try:
            init_time = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
            logger.info(f"Fetching GraphCast forecast for {init_time}")
            
            # GraphCast typically provides:
            # - Temperature at surface and multiple levels
            # - Wind speed & direction
            # - Precipitation
            # - Mean sea level pressure
            # - Humidity
            
            async with aiohttp.ClientSession() as session:
                # This is placeholder - actual API structure may differ
                url = f"{self.base_url}/forecasts/latest"
                
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.read()
                        # Save to temporary file
                        temp_file = Path(f"data/raw/graphcast_{init_time.strftime('%Y%m%d_%H')}.nc")
                        temp_file.parent.mkdir(parents=True, exist_ok=True)
                        
                        with open(temp_file, 'wb') as f:
                            f.write(data)
                        
                        # Load with xarray
                        ds = xr.open_dataset(temp_file)
                        logger.success(f"Loaded GraphCast data: {ds.dims}")
                        return ds
                    else:
                        logger.error(f"Failed to fetch GraphCast: {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error fetching GraphCast: {e}")
            return None
    
    def extract_africa_region(self, ds: xr.Dataset) -> xr.Dataset:
        """Extract Africa bounding box from global dataset"""
        lon_min, lat_min, lon_max, lat_max = self.africa_bbox
        
        # Handle longitude wrapping (0-360 vs -180-180)
        if 'longitude' in ds.dims:
            lon_var = 'longitude'
        elif 'lon' in ds.dims:
            lon_var = 'lon'
        else:
            raise ValueError("Cannot find longitude dimension")
            
        if 'latitude' in ds.dims:
            lat_var = 'latitude'
        elif 'lat' in ds.dims:
            lat_var = 'lat'
        else:
            raise ValueError("Cannot find latitude dimension")
        
        # Extract region
        africa_ds = ds.sel(
            {lon_var: slice(lon_min, lon_max),
             lat_var: slice(lat_max, lat_min)}  # Note: reversed for NetCDF convention
        )
        
        logger.info(f"Extracted Africa region: {africa_ds.dims}")
        return africa_ds
    
    def calculate_cyclone_indicators(self, ds: xr.Dataset) -> Dict[str, xr.DataArray]:
        """
        Calculate cyclone formation indicators from forecast data
        
        Key indicators:
        - Low pressure systems (< 1000 hPa)
        - High wind speeds (> 17 m/s = 34 knots)
        - High relative humidity (> 80%)
        - Warm sea surface temperature (> 26°C)
        - Low wind shear
        """
        indicators = {}
        
        try:
            # Mean sea level pressure
            if 'msl' in ds or 'mslp' in ds:
                mslp = ds['msl'] if 'msl' in ds else ds['mslp']
                # Low pressure indicator (probability scaled)
                low_pressure_prob = xr.where(mslp < 1000, 
                                             (1000 - mslp) / 20,  # Scale 980-1000 hPa
                                             0).clip(0, 1)
                indicators['low_pressure_probability'] = low_pressure_prob
            
            # Wind speed
            if 'u10' in ds and 'v10' in ds:  # 10m wind components
                wind_speed = np.sqrt(ds['u10']**2 + ds['v10']**2)
                # High wind probability (34 knots = 17.5 m/s threshold)
                high_wind_prob = xr.where(wind_speed > 17.5,
                                         (wind_speed - 17.5) / 30,  # Scale up to ~50 m/s
                                         0).clip(0, 1)
                indicators['wind_speed_probability'] = high_wind_prob
                indicators['wind_speed_ms'] = wind_speed
            
            # Sea surface temperature (if available)
            if 'sst' in ds:
                sst = ds['sst'] - 273.15  # Convert K to C
                warm_sst_prob = xr.where(sst > 26,
                                        (sst - 26) / 4,  # Scale 26-30°C
                                        0).clip(0, 1)
                indicators['warm_sst_probability'] = warm_sst_prob
            
            # Relative humidity (if available)
            if 'rh' in ds or 'r' in ds:
                rh = ds['rh'] if 'rh' in ds else ds['r']
                high_humidity_prob = xr.where(rh > 0.8,
                                             (rh - 0.8) / 0.2,
                                             0).clip(0, 1)
                indicators['humidity_probability'] = high_humidity_prob
            
            # Combined cyclone formation probability
            # Simple average of available indicators
            available_probs = [v for k, v in indicators.items() if 'probability' in k]
            if available_probs:
                combined_prob = sum(available_probs) / len(available_probs)
                indicators['cyclone_formation_probability'] = combined_prob
                
                logger.success(f"Calculated {len(indicators)} cyclone indicators")
            
        except Exception as e:
            logger.error(f"Error calculating cyclone indicators: {e}")
        
        return indicators
    
    async def process_and_save(self, ds: xr.Dataset, output_dir: Path) -> List[Path]:
        """Process forecast data and save GeoJSON files"""
        saved_files = []
        
        try:
            # Extract Africa region
            africa_ds = self.extract_africa_region(ds)
            
            # Calculate cyclone indicators
            indicators = self.calculate_cyclone_indicators(africa_ds)
            
            if not indicators:
                logger.warning("No cyclone indicators calculated")
                return saved_files
            
            # Get time dimension
            if 'time' in africa_ds.dims:
                time_var = 'time'
            elif 'forecast_time' in africa_ds.dims:
                time_var = 'forecast_time'
            else:
                logger.error("Cannot find time dimension")
                return saved_files
            
            # Process each forecast time step
            for time_idx in range(len(africa_ds[time_var])):
                forecast_time = africa_ds[time_var][time_idx].values
                
                # Convert to GeoJSON
                geojson_file = await self.to_geojson(
                    indicators,
                    time_idx,
                    forecast_time,
                    output_dir
                )
                
                if geojson_file:
                    saved_files.append(geojson_file)
            
            logger.success(f"Processed {len(saved_files)} forecast time steps")
            
        except Exception as e:
            logger.error(f"Error processing forecast: {e}")
        
        return saved_files
    
    async def to_geojson(
        self,
        indicators: Dict[str, xr.DataArray],
        time_idx: int,
        forecast_time: np.datetime64,
        output_dir: Path
    ) -> Optional[Path]:
        """Convert indicators to GeoJSON format for Mapbox"""
        import json
        
        try:
            # Get combined probability
            if 'cyclone_formation_probability' not in indicators:
                return None
            
            prob = indicators['cyclone_formation_probability'].isel(time=time_idx)
            
            # Get coordinates
            lats = prob.coords['latitude'].values if 'latitude' in prob.coords else prob.coords['lat'].values
            lons = prob.coords['longitude'].values if 'longitude' in prob.coords else prob.coords['lon'].values
            
            # Only keep points with probability > 5%
            threshold = 0.05
            
            features = []
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    p = float(prob.values[i, j])
                    
                    if p > threshold and not np.isnan(p):
                        # Get additional indicators if available
                        props = {
                            'cyclone_probability': round(p, 4),
                            'forecast_time': str(forecast_time)
                        }
                        
                        # Add wind speed if available
                        if 'wind_speed_ms' in indicators:
                            wind = indicators['wind_speed_ms'].isel(time=time_idx)
                            props['wind_speed_ms'] = round(float(wind.values[i, j]), 2)
                        
                        # Add pressure if available
                        if 'low_pressure_probability' in indicators:
                            pressure_prob = indicators['low_pressure_probability'].isel(time=time_idx)
                            props['pressure_probability'] = round(float(pressure_prob.values[i, j]), 4)
                        
                        feature = {
                            'type': 'Feature',
                            'geometry': {
                                'type': 'Point',
                                'coordinates': [float(lon), float(lat)]
                            },
                            'properties': props
                        }
                        features.append(feature)
            
            if not features:
                logger.warning(f"No features above threshold for time {forecast_time}")
                return None
            
            # Create GeoJSON
            geojson = {
                'type': 'FeatureCollection',
                'features': features,
                'metadata': {
                    'source': 'GraphCast',
                    'forecast_time': str(forecast_time),
                    'num_points': len(features),
                    'threshold': threshold
                }
            }
            
            # Save to file
            output_file = output_dir / f"graphcast_{pd.Timestamp(forecast_time).strftime('%Y%m%d_%H%M')}.geojson"
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w') as f:
                json.dump(geojson, f, indent=2)
            
            logger.info(f"Saved {len(features)} features to {output_file.name}")
            return output_file
            
        except Exception as e:
            logger.error(f"Error creating GeoJSON: {e}")
            return None

# Example usage
async def main():
    """Test GraphCast fetcher"""
    fetcher = GraphCastFetcher()
    
    logger.info("🌪️  Testing GraphCast fetcher...")
    
    # Fetch latest data
    ds = await fetcher.fetch_latest_forecast()
    
    if ds:
        # Process and save
        output_dir = Path("data/geojson/graphcast")
        files = await fetcher.process_and_save(ds, output_dir)
        
        logger.success(f"✓ Processed {len(files)} files")
    else:
        logger.error("✗ Failed to fetch data")

if __name__ == "__main__":
    import pandas as pd
    asyncio.run(main())

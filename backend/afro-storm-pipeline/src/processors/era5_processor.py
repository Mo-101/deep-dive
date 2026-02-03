
import xarray as xr
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from loguru import logger
import json

# Earthkit for CDS access (Phase 5)
try:
    import earthkit.data as ekd
    EARTHKIT_AVAILABLE = True
except ImportError:
    EARTHKIT_AVAILABLE = False
    logger.warning("earthkit-data not available. CDS retrieval disabled.")

# Earthkit plots + Cartopy for visualization (Phase 6)
try:
    import earthkit.plots
    import earthkit.plots.styles
    import cartopy.crs as ccrs
    EARTHKIT_PLOTS_AVAILABLE = True
except ImportError:
    EARTHKIT_PLOTS_AVAILABLE = False
    logger.warning("earthkit-plots or cartopy not available. Map image generation disabled.")

class ERA5Processor:
    """
    Processor for large ERA5 Reanalysis Datasets
    Handles: "ERA5-Land" (22GB) and "Thermal Comfort Indices" (10GB)
    Uses Dask chunking for memory-efficient processing
    """
    
    # Key Sentinel Cities for MoStar Grid
    SENTINEL_CITIES = {
        "Lagos": {"lat": 6.5244, "lon": 3.3792},
        "Kinshasa": {"lat": -4.4419, "lon": 15.2663},
        "Nairobi": {"lat": -1.2921, "lon": 36.8219},
        "Antananarivo": {"lat": -18.8792, "lon": 47.5079},
        "Dakar": {"lat": 14.7167, "lon": -17.4677},
        "Addis Ababa": {"lat": 9.0300, "lon": 38.7400},
        "Accra": {"lat": 5.6037, "lon": -0.1870}
    }

    def __init__(self, output_dir: str = "data/processed/climate_baselines"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def process_thermal_comfort(self, nc_file: str):
        """
        Process 'Thermal Comfort Indices' dataset (10GB)
        Extracts UTCI (Universal Thermal Climate Index) extremes
        """
        logger.info(f"🔥 Processing Thermal Comfort Data: {nc_file}")
        
        try:
            # Open with Dask chunks (lazy loading)
            ds = xr.open_dataset(nc_file, chunks={"time": 100})
            
            # Variable check (UTCI is often 'utci' or similar)
            var_name = 'utci' if 'utci' in ds else list(ds.data_vars)[0]
            logger.info(f"   Variable: {var_name}")
            
            results = {}
            
            for city, coords in self.SENTINEL_CITIES.items():
                logger.info(f"   Extracting for {city}...")
                
                # Select nearest point
                city_data = ds[var_name].sel(
                    lat=coords['lat'], 
                    lon=coords['lon'], 
                    method='nearest'
                )
                
                # Calculate aggregated statistics (trigger computation)
                stats = {
                    "mean_utci": float(city_data.mean().values),
                    "max_utci": float(city_data.max().values),
                    "min_utci": float(city_data.min().values),
                    "95th_percentile": float(city_data.quantile(0.95).values),
                    "heat_stress_days": int((city_data > 32).sum().values), # Days > 32°C (Strong heat stress)
                    "last_updated": str(city_data.time[-1].values)
                }
                
                results[city] = stats
                
            # Save Climate Fingerprint
            output_file = self.output_dir / "thermal_comfort_baselines.json"
            with open(output_file, 'w') as f:
                json.dump(results, f, indent=2)
                
            logger.success(f"✓ Thermal baselines saved: {output_file}")
            return results
            
        except Exception as e:
            logger.error(f"Error processing thermal data: {e}")
            raise

    def process_era5_land(self, nc_file: str):
        """
        Process 'ERA5-Land' dataset (22GB)
        Extracts Soil Moisture and Temperature for flood/disease context
        """
        logger.info(f"🌍 Processing ERA5-Land Data: {nc_file}")
        
        try:
            # Open with chunks
            ds = xr.open_dataset(nc_file, chunks={"time": 50})
            
            results = {}
            
            for city, coords in self.SENTINEL_CITIES.items():
                logger.info(f"   Extracting for {city}...")
                
                # Extract relevant variables (e.g., t2m: temp, swvl1: soil moisture)
                # Note: Adjust var names based on your specific file structure
                data_point = ds.sel(
                    latitude=coords['lat'], 
                    longitude=coords['lon'], 
                    method='nearest'
                )
                
                # Compute baselines
                city_stats = {}
                for var in ds.data_vars:
                    # Skip non-relevant vars to save time
                    if var not in ['t2m', 'swvl1', 'tp', 'd2m', 'u10', 'v10']: continue
                    
                    mean_val = float(data_point[var].mean().values)
                    max_val = float(data_point[var].max().values)
                    
                    # Convert Kelvin to Celsius for Temp
                    if var == 't2m' and mean_val > 200:
                        mean_val -= 273.15
                        max_val -= 273.15
                        
                    city_stats[var] = {
                        "mean": mean_val,
                        "max": max_val,
                        "std": float(data_point[var].std().values)
                    }
                
                results[city] = city_stats
                
            # Save Land Fingerprint
            output_file = self.output_dir / "era5_land_baselines.json"
            with open(output_file, 'w') as f:
                json.dump(results, f, indent=2)
                
            logger.success(f"✓ Land baselines saved: {output_file}")
            return results
            
        except Exception as e:
            logger.error(f"Error processing ERA5-Land: {e}")
            raise

    def convert_to_geojson(self, nc_file: str, step: int = 0, resolution_factor: int = 2):
        """
        Convert a NetCDF time step to GeoJSON for Mapbox visualization
        resolution_factor: Skip every N points to reduce size (2 = half res, 4 = quarter res)
        """
        logger.info(f"🗺️  Converting NetCDF to GeoJSON: {nc_file} (Step: {step})")
        try:
            ds = xr.open_dataset(nc_file)
            
            # Select time step and variable
            var_name = list(ds.data_vars)[0]
            if 'time' in ds.coords:
                data_slice = ds[var_name].isel(time=step)
                time_str = str(ds['time'].values[step])
            else:
                data_slice = ds[var_name]
                time_str = "Static"
            
            # Subsample for performance
            # Slicing syntax: [::step]
            data_slice = data_slice.isel(lat=slice(None, None, resolution_factor), lon=slice(None, None, resolution_factor))
            
            # Convert to DataFrame
            df = data_slice.to_dataframe().reset_index()
            df = df.dropna() # Remove NaNs (ocean/missing)
            
            # Use 'latitude'/'longitude' or 'lat'/'lon'
            lat_col = 'lat' if 'lat' in df.columns else 'latitude'
            lon_col = 'lon' if 'lon' in df.columns else 'longitude'
            
            features = []
            for _, row in df.iterrows():
                val = float(row[var_name])
                # Skip invalid values or very low values if needed
                
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row[lon_col]), float(row[lat_col])]
                    },
                    "properties": {
                        "value": val,
                        "variable": var_name,
                        "time": time_str
                    }
                })
            
            geojson = {
                "type": "FeatureCollection",
                "features": features
            }
            
            logger.success(f"✓ Generated {len(features)} points for visualization")
            return geojson
            
        except Exception as e:
            logger.error(f"Error producing GeoJSON: {e}")
            return {"type": "FeatureCollection", "features": []}

    def retrieve_from_cds(
        self,
        dataset: str = "reanalysis-era5-single-levels-monthly-means",
        variables: List[str] = ["2m_temperature"],
        year: str = "2024",
        month: List[str] = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
        product_type: str = "monthly_averaged_reanalysis",
        area: List[float] = [40, -20, -40, 60],  # Africa: North, West, South, East
        output_file: Optional[str] = None
    ) -> Optional[str]:
        """
        Retrieve ERA5 data directly from CDS using earthkit
        
        Args:
            dataset: CDS dataset slug
            variables: List of variable names to retrieve
            year: Year to retrieve
            month: List of months
            product_type: Type of ERA5 product
            area: Bounding box [N, W, S, E]
            output_file: Optional output path (auto-generated if None)
        
        Returns:
            Path to downloaded NetCDF file
        """
        if not EARTHKIT_AVAILABLE:
            logger.error("earthkit-data not installed. Run: pip install earthkit-data")
            return None
        
        logger.info(f"🌍 Retrieving from CDS: {dataset}")
        logger.info(f"   Variables: {variables}")
        logger.info(f"   Period: {year}/{month}")
        logger.info(f"   Region: {area}")
        
        try:
            # Build CDS request
            request = {
                "product_type": [product_type],
                "variable": variables,
                "year": [year],
                "month": month,
                "time": ["00:00"],
                "data_format": "netcdf",
                "download_format": "unarchived",
                "area": area
            }
            
            # Retrieve using earthkit
            data = ekd.from_source("cds", dataset, request)
            
            # Save to file
            if output_file is None:
                var_str = "_".join(variables[:2])  # First 2 vars for filename
                output_file = str(self.output_dir / f"cds_{dataset[:20]}_{var_str}_{year}.nc")
            
            data.save(output_file)
            logger.success(f"✓ Downloaded: {output_file}")
            
            return output_file
            
        except Exception as e:
            logger.error(f"CDS retrieval failed: {e}")
            return None

    def retrieve_era5_monthly(
        self,
        variables: List[str] = ["2m_temperature", "total_precipitation"],
        year: str = "2024"
    ) -> Optional[str]:
        """
        Convenience method to retrieve ERA5 monthly averages for Africa
        """
        return self.retrieve_from_cds(
            dataset="reanalysis-era5-single-levels-monthly-means",
            variables=variables,
            year=year,
            product_type="monthly_averaged_reanalysis",
            area=[40, -20, -40, 60]  # Africa bounding box
        )

    def generate_overview_image(
        self,
        nc_file: str,
        output_file: Optional[str] = None,
        variable: Optional[str] = None,
        time_index: int = 0,
        projection: str = "Robinson",
        figsize: tuple = (6, 6),
        colormap: str = "Spectral_r",
        levels: Optional[range] = None,
        units: str = "celsius"
    ) -> Optional[str]:
        """
        Generate a styled overview image from NetCDF data using earthkit.plots
        
        Args:
            nc_file: Path to NetCDF file
            output_file: Output image path (auto-generated if None)
            variable: Variable to plot (auto-detect if None)
            time_index: Time step to plot
            projection: Cartopy projection name (Robinson, Mercator, etc.)
            figsize: Figure size tuple
            colormap: Matplotlib colormap name
            levels: Range of levels for contours
            units: Units for display
        
        Returns:
            Path to generated image file
        """
        if not EARTHKIT_PLOTS_AVAILABLE:
            logger.error("earthkit-plots or cartopy not installed")
            return None
        
        logger.info(f"🎨 Generating overview image: {nc_file}")
        
        try:
            # Load data using earthkit
            data = ekd.from_source("file", nc_file)
            
            # Get first field if index not specified
            if hasattr(data, '__getitem__'):
                field = data[time_index]
            else:
                field = data
            
            # Define style
            if levels is None:
                # Auto-detect based on variable (robust detection)
                try:
                    if hasattr(field, 'metadata'):
                        field_name = str(field.metadata("shortName", default="")).lower()
                        if not field_name:
                            field_name = str(field.metadata("paramId", default="")).lower()
                    else:
                        field_name = variable or ""
                except:
                    field_name = variable or ""
                
                if "temp" in field_name or "t2m" in field_name or "mrt" in field_name or "2t" in field_name:
                    levels = range(-20, 50, 2)
                    units = "celsius"
                elif "precip" in field_name or "tp" in field_name:
                    levels = range(0, 500, 25)
                    units = "mm"
                else:
                    levels = range(0, 100, 5)
            
            style = earthkit.plots.styles.Style(
                colors=colormap,
                levels=levels,
                extend="both",
                units=units,
            )
            
            # Set figure size
            earthkit.plots.schema.figure.set(figsize=figsize)
            
            # Create projection
            if projection == "Robinson":
                crs = ccrs.Robinson()
            elif projection == "Mercator":
                crs = ccrs.Mercator()
            elif projection == "PlateCarree":
                crs = ccrs.PlateCarree()
            elif projection == "NearsidePerspective":
                crs = ccrs.NearsidePerspective(central_longitude=25, central_latitude=0)
            else:
                crs = ccrs.Robinson()
            
            # Create chart
            chart = earthkit.plots.Map(crs=crs)
            chart.pcolormesh(field, style=style)
            chart.coastlines()
            chart.gridlines(draw_labels=False)
            chart.legend(location="bottom")
            
            # Title with metadata
            chart.title(
                "{variable_name}\n{time:%B %Y}",
                fontsize=11,
            )
            
            # Save
            if output_file is None:
                output_file = str(self.output_dir / f"overview_{Path(nc_file).stem}.png")
            
            chart.save(output_file)
            logger.success(f"✓ Overview saved: {output_file}")
            
            return output_file
            
        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            return None

    def generate_thumbnail(
        self,
        nc_file: str,
        output_file: Optional[str] = None,
        time_index: int = 0
    ) -> Optional[str]:
        """
        Generate a small thumbnail image (3x3) for UI previews
        """
        return self.generate_overview_image(
            nc_file=nc_file,
            output_file=output_file,
            time_index=time_index,
            projection="Robinson",
            figsize=(3, 3)
        )

if __name__ == "__main__":
    # Example usage
    processor = ERA5Processor()
    
    # Test CDS retrieval (requires valid CDS credentials in ~/.cdsapirc)
    # processor.retrieve_era5_monthly(["2m_temperature"], "2024")
    
    # Test image generation
    # processor.generate_overview_image("path/to/data.nc", projection="Robinson")
    
    # processor.process_thermal_comfort("path/to/thermal_indices.nc")
    # processor.process_era5_land("path/to/era5_land.nc")

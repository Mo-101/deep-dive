"""
ECMWF Open Data Fetcher
Downloads high-resolution weather forecasts using ecmwf-opendata
0.25° resolution (25km), 10-day forecasts
"""

import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from loguru import logger
import subprocess
import sys

class ECMWFFetcher:
    """
    ECMWF Open Data Fetcher
    
    Downloads global weather forecasts at 0.25° resolution
    Uses ecmwf-opendata Python package
    
    Features:
    - 0.25° resolution (~25km)
    - 10-day forecasts
    - 00, 06, 12, 18 UTC cycles
    - Ensemble and HRES (high resolution) forecasts
    """
    
    def __init__(self):
        self.output_dir = Path("data/raw/ecmwf")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    async def fetch_latest_forecast(
        self,
        params: List[str] = None,
        steps: List[int] = None,
        forecast_type: str = "fc",  # fc (forecast), cf (control), pf (perturbed)
        stream: str = "oper",  # oper (HRES), enfo (ENS)
        target: Optional[str] = None
    ) -> Optional[Path]:
        """
        Download latest ECMWF forecast
        
        Args:
            params: List of parameters (e.g., ['2t', 'msl', '10u', '10v', 'tp'])
            steps: Forecast steps in hours (e.g., [0, 6, 12, ..., 240])
            forecast_type: 'fc' for forecast, 'cf'/'pf' for ensemble
            stream: 'oper' for HRES, 'enfo' for ensemble
            target: Output file path
        
        Returns:
            Path to downloaded GRIB2 file
        """
        try:
            # Default parameters for cyclone tracking
            if params is None:
                params = [
                    "10u", "10v",      # 10m wind
                    "2t",               # 2m temperature
                    "msl",              # Mean sea level pressure
                    "tp",               # Total precipitation
                    "skt",              # Skin temperature
                ]
            
            # Default steps: every 6 hours for 10 days
            if steps is None:
                steps = list(range(0, 241, 6))
            
            # Generate target filename
            if target is None:
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M")
                target = self.output_dir / f"ecmwf_{stream}_{forecast_type}_{timestamp}.grib2"
            else:
                target = Path(target)
            
            logger.info(f"📥 Fetching ECMWF forecast: {stream}/{forecast_type}")
            logger.info(f"   Parameters: {params}")
            logger.info(f"   Steps: {steps[0]} to {steps[-1]} hours")
            
            # Build Python script for ecmwf-opendata
            script = f"""
from ecmwf.opendata import Client

client = Client(source="ecmwf")

result = client.retrieve(
    stream="{stream}",
    type="{forecast_type}",
    param={params},
    step={steps},
    target="{target}"
)

print(f"Downloaded: {{result.datetime}}")
"""
            
            # Run the download
            process = await asyncio.create_subprocess_exec(
                sys.executable, "-c", script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.success(f"✓ ECMWF forecast saved: {target}")
                logger.info(f"   Forecast time: {stdout.decode().strip()}")
                return target
            else:
                logger.error(f"ECMWF download failed: {stderr.decode()}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching ECMWF data: {e}")
            return None
    
    async def fetch_cyclone_track(
        self,
        time: int = 0,
        step: int = 240,
        target: Optional[str] = None
    ) -> Optional[Path]:
        """
        Download tropical cyclone track forecast
        
        Args:
            time: Forecast run time (0, 6, 12, 18 UTC)
            step: Maximum forecast step (90 for 06/18, 240 for 00/12)
            target: Output file path
        
        Returns:
            Path to downloaded BUFR file
        """
        try:
            if target is None:
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M")
                target = self.output_dir / f"ecmwf_cyclone_track_{timestamp}.bufr"
            
            logger.info(f"📥 Fetching ECMWF cyclone track forecast")
            
            script = f"""
from ecmwf.opendata import Client

client = Client(source="ecmwf")

result = client.retrieve(
    time={time},
    stream="oper",
    type="tf",  # Tropical cyclone track
    step={step},
    target="{target}"
)

print(f"Downloaded: {{result.datetime}}")
"""
            
            process = await asyncio.create_subprocess_exec(
                sys.executable, "-c", script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.success(f"✓ Cyclone track forecast saved: {target}")
                return target
            else:
                logger.error(f"Cyclone track download failed: {stderr.decode()}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching cyclone track: {e}")
            return None
    
    async def fetch_ensemble_forecast(
        self,
        params: List[str] = None,
        steps: List[int] = None,
        numbers: List[int] = None,
        target: Optional[str] = None
    ) -> Optional[Path]:
        """
        Download ensemble forecast
        
        Args:
            params: List of parameters
            steps: Forecast steps
            numbers: Ensemble member numbers (1-50)
            target: Output file path
        
        Returns:
            Path to downloaded GRIB2 file
        """
        try:
            if params is None:
                params = ["2t", "msl", "10u", "10v"]
            
            if steps is None:
                steps = list(range(0, 241, 6))
            
            if numbers is None:
                numbers = list(range(1, 51))  # All 50 members
            
            if target is None:
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M")
                target = self.output_dir / f"ecmwf_ens_{timestamp}.grib2"
            
            logger.info(f"📥 Fetching ECMWF ensemble forecast")
            logger.info(f"   Members: {len(numbers)}")
            
            script = f"""
from ecmwf.opendata import Client

client = Client(source="ecmwf")

result = client.retrieve(
    stream="enfo",
    type="pf",
    param={params},
    step={steps},
    number={numbers},
    target="{target}"
)

print(f"Downloaded: {{result.datetime}}")
"""
            
            process = await asyncio.create_subprocess_exec(
                sys.executable, "-c", script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.success(f"✓ Ensemble forecast saved: {target}")
                return target
            else:
                logger.error(f"Ensemble download failed: {stderr.decode()}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching ensemble: {e}")
            return None
    
    async def get_latest_available_time(self) -> Optional[datetime]:
        """Check the latest available forecast time"""
        try:
            script = """
from ecmwf.opendata import Client

client = Client(source="ecmwf")

result = client.latest(
    stream="oper",
    type="fc",
    step=24,
    param="2t"
)

print(result)
"""
            
            process = await asyncio.create_subprocess_exec(
                sys.executable, "-c", script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                time_str = stdout.decode().strip()
                return datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
            
            return None
            
        except Exception as e:
            logger.error(f"Error checking latest time: {e}")
            return None
    
    def list_available_params(self) -> Dict[str, List[str]]:
        """List all available parameters by category"""
        return {
            "surface": [
                "10u", "10v",          # 10m wind
                "2t",                  # 2m temperature
                "msl",                 # Mean sea level pressure
                "sp",                  # Surface pressure
                "tp",                  # Total precipitation
                "skt",                 # Skin temperature
                "tcwv",                # Total column water vapor
                "ro",                  # Runoff
            ],
            "pressure_levels": [
                "u", "v",              # Wind components
                "t",                   # Temperature
                "q",                   # Specific humidity
                "gh",                  # Geopotential height
                "r",                   # Relative humidity
                "vo",                  # Vorticity
                "d",                   # Divergence
            ],
            "waves": [
                "swh",                 # Significant wave height
                "mwp",                 # Mean wave period
                "mwd",                 # Mean wave direction
                "pp1d",                # Peak wave period
                "mp2",                 # Mean zero-crossing period
            ],
            "ensemble": [
                "gh", "t", "ws",       # Ensemble mean/std
            ],
            "probabilities": [
                "tpg1", "tpg5", "tpg10", "tpg25", "tpg50", "tpg100",  # Precipitation
                "10fgg10", "10fgg15", "10fgg25",                       # Wind gusts
            ]
        }

# Example usage
async def main():
    """Test ECMWF fetcher"""
    logger.info("🌍 Testing ECMWF Open Data Fetcher")
    
    fetcher = ECMWFFetcher()
    
    # Check latest available forecast
    latest = await fetcher.get_latest_available_time()
    if latest:
        logger.info(f"Latest forecast available: {latest}")
    
    # Fetch basic forecast
    result = await fetcher.fetch_latest_forecast(
        params=["2t", "msl", "10u", "10v"],
        steps=[0, 24, 48, 72, 96, 120]
    )
    
    if result:
        logger.success(f"Downloaded: {result}")
    else:
        logger.error("Download failed")

if __name__ == "__main__":
    asyncio.run(main())

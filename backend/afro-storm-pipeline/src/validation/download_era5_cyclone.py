#!/usr/bin/env python3
"""
ERA5 Data Downloader for AFRO Storm Validation
===============================================

Downloads ERA5 reanalysis data from ECMWF CDS for cyclone validation.

Requires:
- CDS API key configured (~/.cdsapirc)
- cdsapi package installed

Usage:
  python download_era5_cyclone.py --event idai
  python download_era5_cyclone.py --event freddy
  python download_era5_cyclone.py --start 2019-03-01 --end 2019-03-16 --output era5_custom.nc
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import argparse

from loguru import logger

try:
    import cdsapi
    CDS_AVAILABLE = True
except ImportError:
    logger.warning("cdsapi not installed. Run: pip install cdsapi")
    CDS_AVAILABLE = False


# =============================================================================
# CYCLONE EVENT DEFINITIONS
# =============================================================================

CYCLONE_EVENTS = {
    "idai": {
        "name": "Cyclone Idai",
        "year": 2019,
        "month": 3,
        "days": list(range(1, 17)),  # March 1-16, 2019
        "area": [-10, 30, -30, 50],  # North, West, South, East
        "description": "Deadliest cyclone in Southern Hemisphere (1,303 deaths)"
    },
    "freddy": {
        "name": "Cyclone Freddy",
        "year": 2023,
        "month": 2,
        "days": list(range(1, 29)),  # February 2023 (full month)
        "area": [-5, 30, -30, 80],   # Wider area - Freddy crossed entire Indian Ocean
        "description": "Longest-lasting tropical cyclone on record (1,434 deaths)"
    },
    "freddy_march": {
        "name": "Cyclone Freddy (March)",
        "year": 2023,
        "month": 3,
        "days": list(range(1, 16)),  # March 1-15, 2023 (second landfall)
        "area": [-10, 30, -30, 50],
        "description": "Freddy's second Mozambique landfall"
    },
    "batsirai": {
        "name": "Cyclone Batsirai",
        "year": 2022,
        "month": 2,
        "days": list(range(1, 15)),  # February 1-14, 2022
        "area": [-10, 40, -30, 60],
        "description": "Major Madagascar cyclone (121 deaths)"
    },
    "eloise": {
        "name": "Cyclone Eloise",
        "year": 2021,
        "month": 1,
        "days": list(range(15, 31)),  # January 15-30, 2021
        "area": [-10, 30, -30, 50],
        "description": "Mozambique cyclone (21 deaths)"
    }
}

# Variables needed for cyclone detection
ERA5_VARIABLES = [
    "mean_sea_level_pressure",
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
    "total_precipitation",
]

# Additional variables for full analysis
ERA5_VARIABLES_FULL = ERA5_VARIABLES + [
    "sea_surface_temperature",
    "total_column_water_vapour",
    "2m_temperature",
]


# =============================================================================
# DOWNLOAD FUNCTIONS
# =============================================================================

def download_era5_cyclone(
    event_key: str,
    output_dir: Path,
    full_variables: bool = False
) -> Optional[Path]:
    """Download ERA5 data for a specific cyclone event."""
    
    if not CDS_AVAILABLE:
        logger.error("cdsapi not available. Install with: pip install cdsapi")
        return None
    
    if event_key not in CYCLONE_EVENTS:
        logger.error(f"Unknown event: {event_key}")
        logger.info(f"Available events: {list(CYCLONE_EVENTS.keys())}")
        return None
    
    event = CYCLONE_EVENTS[event_key]
    logger.info(f"Downloading ERA5 data for {event['name']}")
    logger.info(f"Description: {event['description']}")
    
    output_file = output_dir / f"era5_{event_key}_{event['year']}{event['month']:02d}.nc"
    
    if output_file.exists():
        logger.info(f"File already exists: {output_file}")
        return output_file
    
    variables = ERA5_VARIABLES_FULL if full_variables else ERA5_VARIABLES
    
    return _download_era5(
        year=event["year"],
        month=event["month"],
        days=event["days"],
        area=event["area"],
        variables=variables,
        output_file=output_file
    )


def download_era5_custom(
    start_date: str,
    end_date: str,
    area: List[float],
    output_file: Path,
    full_variables: bool = False
) -> Optional[Path]:
    """Download ERA5 data for a custom date range."""
    
    if not CDS_AVAILABLE:
        logger.error("cdsapi not available")
        return None
    
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    if start.year != end.year or start.month != end.month:
        logger.warning("Date range spans multiple months - downloading first month only")
    
    days = list(range(start.day, end.day + 1))
    variables = ERA5_VARIABLES_FULL if full_variables else ERA5_VARIABLES
    
    return _download_era5(
        year=start.year,
        month=start.month,
        days=days,
        area=area,
        variables=variables,
        output_file=output_file
    )


def _download_era5(
    year: int,
    month: int,
    days: List[int],
    area: List[float],
    variables: List[str],
    output_file: Path
) -> Optional[Path]:
    """Internal function to download ERA5 data from CDS."""
    
    logger.info(f"Year: {year}, Month: {month}")
    logger.info(f"Days: {days[0]}-{days[-1]}")
    logger.info(f"Area: {area}")
    logger.info(f"Variables: {len(variables)}")
    logger.info(f"Output: {output_file}")
    
    try:
        c = cdsapi.Client()
        
        request = {
            "product_type": "reanalysis",
            "variable": variables,
            "year": str(year),
            "month": f"{month:02d}",
            "day": [f"{d:02d}" for d in days],
            "time": [f"{h:02d}:00" for h in range(0, 24, 6)],  # 00, 06, 12, 18 UTC
            "area": area,  # North, West, South, East
            "format": "netcdf",
        }
        
        logger.info("Submitting request to CDS API...")
        logger.info("This may take 5-30 minutes depending on queue...")
        
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        c.retrieve(
            "reanalysis-era5-single-levels",
            request,
            str(output_file)
        )
        
        logger.success(f"Download complete: {output_file}")
        logger.info(f"File size: {output_file.stat().st_size / 1024 / 1024:.1f} MB")
        
        return output_file
        
    except Exception as e:
        logger.error(f"Download failed: {e}")
        logger.info("\nTroubleshooting:")
        logger.info("1. Check ~/.cdsapirc exists with valid API key")
        logger.info("2. Verify CDS account at: https://cds.climate.copernicus.eu/")
        logger.info("3. Accept license terms for ERA5 dataset")
        return None


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Download ERA5 data for cyclone validation"
    )
    
    parser.add_argument(
        "--event",
        choices=list(CYCLONE_EVENTS.keys()),
        help="Pre-defined cyclone event"
    )
    
    parser.add_argument(
        "--start",
        help="Start date (YYYY-MM-DD) for custom download"
    )
    
    parser.add_argument(
        "--end",
        help="End date (YYYY-MM-DD) for custom download"
    )
    
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent.parent.parent / "data_dir",
        help="Output directory"
    )
    
    parser.add_argument(
        "--full",
        action="store_true",
        help="Download full variable set (SST, humidity, etc.)"
    )
    
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available cyclone events"
    )
    
    args = parser.parse_args()
    
    if args.list:
        print("\nAvailable Cyclone Events:")
        print("=" * 60)
        for key, event in CYCLONE_EVENTS.items():
            print(f"\n  {key}:")
            print(f"    Name: {event['name']}")
            print(f"    Date: {event['year']}-{event['month']:02d}")
            print(f"    Description: {event['description']}")
        print()
        return
    
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if args.event:
        result = download_era5_cyclone(args.event, output_dir, args.full)
        if result:
            logger.info(f"\n[SUCCESS] Ready for validation:")
            logger.info(f"  python -m src.validation.validation_idai --era5 {result}")
    
    elif args.start and args.end:
        output_file = output_dir / f"era5_custom_{args.start}_{args.end}.nc"
        area = [-10, 30, -30, 50]  # Default: Mozambique Channel
        result = download_era5_custom(args.start, args.end, area, output_file, args.full)
    
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python download_era5_cyclone.py --event idai")
        print("  python download_era5_cyclone.py --event freddy")
        print("  python download_era5_cyclone.py --start 2019-03-01 --end 2019-03-16")
        print("  python download_era5_cyclone.py --list")


if __name__ == "__main__":
    main()

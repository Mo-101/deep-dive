"""
Validation API Routes
Endpoints for testing AFRO Storm against historical cyclones
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from datetime import datetime
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from validation.validate_idai import IdaiValidator, LANDFALL_TIME, BEIRA_LOCATION

router = APIRouter(prefix="/validation", tags=["Validation"])


@router.get("/idai")
async def validate_idai() -> Dict[str, Any]:
    """
    Run Cyclone Idai validation test.
    
    Returns whether AFRO Storm would have detected Idai before Beira landfall.
    """
    try:
        validator = IdaiValidator()
        results = validator.run_full_validation()
        
        return {
            "success": True,
            "cyclone": "Idai",
            "landfall": LANDFALL_TIME.isoformat(),
            "target_city": "Beira, Mozambique",
            "detected": results["detection"]["detected"],
            "lead_time_hours": results["detection"]["lead_time_hours"],
            "passed_validation": results["passed_validation"],
            "detection_time": results["detection"]["detection_time"],
            "report": results["report"],
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/idai/summary")
async def idai_summary() -> Dict[str, Any]:
    """Get summary of Cyclone Idai validation."""
    return {
        "cyclone": "Idai",
        "year": 2019,
        "basin": "Southwest Indian Ocean",
        "landfall": {
            "time": LANDFALL_TIME.isoformat(),
            "location": BEIRA_LOCATION,
            "city": "Beira, Mozambique",
        },
        "impact": {
            "deaths": 1303,
            "affected": 3000000,
            "damage_usd": 2000000000,
        },
        "afro_storm_validation": {
            "expected_detection": "2019-03-10T00:00:00",
            "expected_lead_time": 84,  # hours
            "target_lead_time": 72,  # hours
            "minimum_lead_time": 48,  # hours
        },
    }


@router.get("/historical-cyclones")
async def list_historical_cyclones() -> list[Dict[str, Any]]:
    """List cyclones available for validation testing."""
    return [
        {
            "id": "idai-2019",
            "name": "Idai",
            "year": 2019,
            "basin": "SWIO",
            "landfall": "Beira, Mozambique",
            "deaths": 1303,
            "status": "available",
        },
        {
            "id": "freddy-2023",
            "name": "Freddy",
            "year": 2023,
            "basin": "SWIO",
            "landfall": "Mozambique/Malawi",
            "deaths": 1434,
            "status": "planned",
        },
        {
            "id": "kenneth-2019",
            "name": "Kenneth",
            "year": 2019,
            "basin": "SWIO",
            "landfall": "Mozambique",
            "deaths": 52,
            "status": "planned",
        },
    ]

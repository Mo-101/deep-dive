"""
ECMWF API Routes
Endpoints for accessing ECMWF open data
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import asyncio
from loguru import logger

from ..data_sources.ecmwf_fetcher import ECMWFFetcher

router = APIRouter(prefix="/ecmwf", tags=["ECMWF"])

fetcher = ECMWFFetcher()


class ForecastRequest(BaseModel):
    params: List[str] = ["2t", "msl", "10u", "10v"]
    steps: List[int] = [0, 6, 12, 24, 48, 72, 96, 120]
    forecast_type: str = "fc"
    stream: str = "oper"


class CycloneTrackRequest(BaseModel):
    time: int = 0
    step: int = 240


class EnsembleRequest(BaseModel):
    params: List[str] = ["2t", "msl", "10u", "10v"]
    steps: List[int] = [0, 24, 48, 72, 96, 120]
    numbers: Optional[List[int]] = None


@router.get("/status")
async def get_status() -> Dict[str, Any]:
    """Get ECMWF fetcher status"""
    latest = await fetcher.get_latest_available_time()
    
    return {
        "status": "operational",
        "latest_forecast": latest.isoformat() if latest else None,
        "resolution": "0.25 degrees (~25km)",
        "forecast_range": "10 days",
        "cycles": ["00", "06", "12", "18"],
        "products": ["HRES", "ENS"]
    }


@router.get("/params")
async def get_available_params() -> Dict[str, List[str]]:
    """Get list of available parameters"""
    return fetcher.list_available_params()


@router.post("/forecast")
async def fetch_forecast(request: ForecastRequest) -> Dict[str, Any]:
    """Download ECMWF forecast"""
    try:
        result = await fetcher.fetch_latest_forecast(
            params=request.params,
            steps=request.steps,
            forecast_type=request.forecast_type,
            stream=request.stream
        )
        
        if result:
            return {
                "success": True,
                "file": str(result),
                "forecast_type": request.forecast_type,
                "stream": request.stream,
                "params": request.params,
                "steps": request.steps
            }
        else:
            raise HTTPException(status_code=500, detail="Download failed")
    
    except Exception as e:
        logger.error(f"Error in forecast download: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cyclone-track")
async def fetch_cyclone_track(request: CycloneTrackRequest) -> Dict[str, Any]:
    """Download tropical cyclone track forecast"""
    try:
        result = await fetcher.fetch_cyclone_track(
            time=request.time,
            step=request.step
        )
        
        if result:
            return {
                "success": True,
                "file": str(result),
                "format": "BUFR",
                "time": request.time,
                "step": request.step
            }
        else:
            raise HTTPException(status_code=500, detail="Download failed")
    
    except Exception as e:
        logger.error(f"Error in cyclone track download: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ensemble")
async def fetch_ensemble(request: EnsembleRequest) -> Dict[str, Any]:
    """Download ensemble forecast"""
    try:
        result = await fetcher.fetch_ensemble_forecast(
            params=request.params,
            steps=request.steps,
            numbers=request.numbers
        )
        
        if result:
            return {
                "success": True,
                "file": str(result),
                "members": len(request.numbers) if request.numbers else 50,
                "params": request.params,
                "steps": request.steps
            }
        else:
            raise HTTPException(status_code=500, detail="Download failed")
    
    except Exception as e:
        logger.error(f"Error in ensemble download: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest-time")
async def get_latest_time() -> Dict[str, Any]:
    """Get latest available forecast time"""
    latest = await fetcher.get_latest_available_time()
    
    if latest:
        return {
            "latest_forecast_time": latest.isoformat(),
            "age_hours": (asyncio.get_event_loop().time() - latest.timestamp()) / 3600
        }
    else:
        raise HTTPException(status_code=503, detail="Unable to determine latest forecast time")

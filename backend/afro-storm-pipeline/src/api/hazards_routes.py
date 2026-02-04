"""
Hazards API Routes
Real-time hazard data endpoint for unified map

Integrates with detection processors that have built-in fallback to demo data.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from loguru import logger

router = APIRouter(prefix="/hazards", tags=["Hazards"])

# Import detection systems with safe fallback
DETECTORS_AVAILABLE = False

try:
    from ..processors.tempest_detector import detect_cyclones_realtime, detector as cyclone_detector
    from ..processors.sar_flood_detector import detect_floods_from_sentinel, flood_detector
    from ..processors.landslide_risk_calculator import calculate_landslide_risks, landslide_calculator
    DETECTORS_AVAILABLE = True
    logger.success("✅ All hazard detectors loaded successfully")
except ImportError as e:
    logger.warning(f"⚠️ Detection processors not available, using inline demo data: {e}")
    cyclone_detector = None
    flood_detector = None
    landslide_calculator = None


def generate_demo_hazards() -> Dict[str, Any]:
    """Generate demo hazard data for testing."""
    now = datetime.utcnow()
    
    return {
        "cyclones": [
            {
                "id": "cyclone-001",
                "name": "Tropical Storm Demo",
                "center": {"lat": -15.2, "lon": 42.5},
                "track": [
                    {"lat": -14.5, "lon": 43.2, "time": (now - timedelta(hours=24)).isoformat()},
                    {"lat": -15.2, "lon": 42.5, "time": now.isoformat()},
                    {"lat": -16.0, "lon": 41.8, "time": (now + timedelta(hours=24)).isoformat()},
                ],
                "maxWind": 55,
                "category": "TS",
                "updated": now.isoformat(),
            }
        ],
        "floods": [
            {
                "id": "flood-001",
                "polygon": {
                    "type": "Polygon",
                    "coordinates": [[
                        [39.2, -19.8],
                        [39.4, -19.8],
                        [39.4, -20.0],
                        [39.2, -20.0],
                        [39.2, -19.8],
                    ]],
                },
                "area_km2": 45.3,
                "detected_date": now.isoformat(),
                "source": "Sentinel-1 SAR (Demo)",
            }
        ],
        "landslides": [
            {
                "id": "landslide-001",
                "location": {"lat": -19.5, "lon": 34.2},
                "risk_level": "high",
                "slope_angle": 35,
                "rainfall_mm": 180,
            },
            {
                "id": "landslide-002",
                "location": {"lat": -18.8, "lon": 35.1},
                "risk_level": "medium",
                "slope_angle": 28,
                "rainfall_mm": 120,
            },
        ],
        "waterlogged": [
            {
                "id": "water-001",
                "polygon": {
                    "type": "Polygon",
                    "coordinates": [[
                        [34.8, -19.9],
                        [35.0, -19.9],
                        [35.0, -20.1],
                        [34.8, -20.1],
                        [34.8, -19.9],
                    ]],
                },
                "depth_cm": 25,
                "duration_hours": 48,
            }
        ],
        "lastUpdated": now.isoformat(),
        "source": "demo",
    }


@router.get("/realtime")
async def get_realtime_hazards(
    hours: int = Query(24, description="Lookback hours for detections"),
    region: str = Query("africa", description="Region name"),
    bbox: Optional[str] = Query(None, description="Bounding box: minLon,minLat,maxLon,maxLat"),
) -> Dict[str, Any]:
    """
    Get all current hazards (cyclones, floods, landslides, waterlogged areas).
    
    Uses real detection processors when available, falls back to demo data otherwise.
    Auto-refreshes every 10 minutes on frontend.
    """
    try:
        now = datetime.utcnow()
        
        # Parse bounding box if provided
        if bbox:
            coords = [float(x) for x in bbox.split(',')]
            aoi_bbox = (coords[0], coords[1], coords[2], coords[3])
        else:
            # Default: Mozambique/Madagascar region  
            aoi_bbox = (30, -25, 55, -10)
        
        if DETECTORS_AVAILABLE:
            logger.info(f"Running detection for region={region}, hours={hours}")
            
            # CYCLONES (TempestExtremes + ERA5)
            try:
                cyclones = detect_cyclones_realtime("", now)
                cyclones_data = [{
                    "id": c.id,
                    "name": c.name,
                    "center": c.center,
                    "track": c.track,
                    "maxWind": c.max_wind,
                    "category": c.category,
                    "updated": c.detection_time.isoformat(),
                } for c in cyclones]
            except Exception as e:
                logger.warning(f"Cyclone detection failed, using demo: {e}")
                cyclones_data = generate_demo_hazards()["cyclones"]
            
            # FLOODS (Sentinel-1 SAR)
            try:
                floods = detect_floods_from_sentinel(aoi_bbox, now - timedelta(days=7), now)
                floods_data = [{
                    "id": f.id,
                    "polygon": f.polygon,
                    "area_km2": f.area_km2,
                    "detected_date": f.detection_date.isoformat(),
                    "source": f.source,
                } for f in floods]
            except Exception as e:
                logger.warning(f"Flood detection failed, using demo: {e}")
                floods_data = generate_demo_hazards()["floods"]
            
            # LANDSLIDES (Rainfall + Slope)
            try:
                landslides = calculate_landslide_risks(aoi_bbox, now)
                landslides_data = [{
                    "id": r.id,
                    "location": r.location,
                    "risk_level": r.risk_level,
                    "slope_angle": r.slope_angle,
                    "rainfall_mm": r.rainfall_mm,
                } for r in landslides]
            except Exception as e:
                logger.warning(f"Landslide calculation failed, using demo: {e}")
                landslides_data = generate_demo_hazards()["landslides"]
            
            # WATERLOGGED (derived from floods)
            waterlogged_data = [{
                "id": f"water-{f['id'].split('-')[-1]}",
                "polygon": f["polygon"],
                "depth_cm": 20,
                "duration_hours": 36,
            } for f in floods_data[:2]] if floods_data else generate_demo_hazards()["waterlogged"]
            
            source = "detection"
        else:
            # Use demo data
            demo = generate_demo_hazards()
            cyclones_data = demo["cyclones"]
            floods_data = demo["floods"]
            landslides_data = demo["landslides"]
            waterlogged_data = demo["waterlogged"]
            source = "demo"
        
        logger.info(f"Returning {len(cyclones_data)} cyclones, {len(floods_data)} floods, {len(landslides_data)} landslides")
        
        return {
            "success": True,
            "source": source,
            "region": region,
            "cyclones": cyclones_data,
            "floods": floods_data,
            "landslides": landslides_data,
            "waterlogged": waterlogged_data,
            "lastUpdated": now.isoformat(),
        }
    
    except Exception as e:
        logger.error(f"Hazards realtime error: {e}")
        # Always return demo data on error so frontend never breaks
        demo = generate_demo_hazards()
        return {
            "success": False,
            "error": str(e),
            "source": "demo",
            **demo,
        }


@router.get("/cyclones")
async def get_cyclones_only(
    hours: int = Query(24, description="Hours of detection history")
) -> Dict[str, Any]:
    """Get only cyclone data."""
    try:
        now = datetime.utcnow()
        
        if DETECTORS_AVAILABLE:
            try:
                cyclones = detect_cyclones_realtime("", now)
                cyclones_data = [{
                    "id": c.id,
                    "name": c.name,
                    "center": c.center,
                    "track": c.track,
                    "maxWind": c.max_wind,
                    "category": c.category,
                    "detection_time": c.detection_time.isoformat(),
                    "basin": c.basin,
                } for c in cyclones]
            except Exception as e:
                logger.warning(f"Cyclone detection error: {e}")
                cyclones_data = generate_demo_hazards()["cyclones"]
        else:
            cyclones_data = generate_demo_hazards()["cyclones"]
        
        return {
            "success": True,
            "count": len(cyclones_data),
            "cyclones": cyclones_data,
            "lastUpdated": now.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching cyclones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/floods")
async def get_floods_only(
    days: int = Query(7, description="Days of detection history"),
    bbox: Optional[str] = Query(None, description="Bounding box"),
) -> Dict[str, Any]:
    """Get only flood data from Sentinel-1 SAR."""
    try:
        now = datetime.utcnow()
        
        if bbox:
            coords = [float(x) for x in bbox.split(',')]
            aoi_bbox = (coords[0], coords[1], coords[2], coords[3])
        else:
            aoi_bbox = (30, -25, 55, -10)
        
        if DETECTORS_AVAILABLE:
            try:
                floods = detect_floods_from_sentinel(aoi_bbox, now - timedelta(days=days), now)
                floods_data = [{
                    "id": f.id,
                    "polygon": f.polygon,
                    "area_km2": f.area_km2,
                    "detected_date": f.detection_date.isoformat(),
                    "confidence": f.confidence,
                    "source": f.source,
                } for f in floods]
            except Exception as e:
                logger.warning(f"Flood detection error: {e}")
                floods_data = generate_demo_hazards()["floods"]
        else:
            floods_data = generate_demo_hazards()["floods"]
        
        return {
            "success": True,
            "count": len(floods_data),
            "floods": floods_data,
            "lastUpdated": now.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching floods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/landslides")
async def get_landslides_only(
    bbox: Optional[str] = Query(None, description="Bounding box"),
) -> Dict[str, Any]:
    """Get landslide risk calculations."""
    try:
        now = datetime.utcnow()
        
        if bbox:
            coords = [float(x) for x in bbox.split(',')]
            aoi_bbox = (coords[0], coords[1], coords[2], coords[3])
        else:
            aoi_bbox = (30, -25, 55, -10)
        
        if DETECTORS_AVAILABLE:
            try:
                risks = calculate_landslide_risks(aoi_bbox, now)
                landslides_data = [{
                    "id": r.id,
                    "location": r.location,
                    "risk_level": r.risk_level,
                    "risk_score": r.risk_score,
                    "slope_angle": r.slope_angle,
                    "rainfall_mm": r.rainfall_mm,
                    "contributing_factors": r.contributing_factors,
                } for r in risks]
            except Exception as e:
                logger.warning(f"Landslide calculation error: {e}")
                landslides_data = generate_demo_hazards()["landslides"]
        else:
            landslides_data = generate_demo_hazards()["landslides"]
        
        return {
            "success": True,
            "count": len(landslides_data),
            "landslides": landslides_data,
            "lastUpdated": now.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching landslides: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_hazards_summary() -> Dict[str, Any]:
    """Get summary counts of active hazards."""
    try:
        hazards = await get_realtime_hazards()
        
        return {
            "cyclones": len(hazards.get("cyclones", [])),
            "floods": len(hazards.get("floods", [])),
            "landslides": len(hazards.get("landslides", [])),
            "waterlogged": len(hazards.get("waterlogged", [])),
            "totalActive": sum([
                len(hazards.get("cyclones", [])),
                len(hazards.get("floods", [])),
                len(hazards.get("landslides", [])),
                len(hazards.get("waterlogged", [])),
            ]),
            "lastUpdated": hazards.get("lastUpdated"),
            "source": hazards.get("source"),
        }
    except Exception as e:
        logger.error(f"Error getting summary: {e}")
        return {
            "cyclones": 0,
            "floods": 0,
            "landslides": 0,
            "waterlogged": 0,
            "totalActive": 0,
            "error": str(e),
        }


@router.get("/by-region/{region}")
async def get_hazards_by_region(region: str) -> Dict[str, Any]:
    """Get hazards filtered by region."""
    regions = {
        "mozambique": {"minLat": -27, "maxLat": -10, "minLon": 30, "maxLon": 41},
        "madagascar": {"minLat": -26, "maxLat": -11, "minLon": 43, "maxLon": 51},
        "malawi": {"minLat": -17, "maxLat": -9, "minLon": 33, "maxLon": 36},
        "zimbabwe": {"minLat": -22, "maxLat": -15, "minLon": 25, "maxLon": 33},
    }
    
    bounds = regions.get(region.lower())
    if not bounds:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    
    # Get all hazards then filter
    all_hazards = await get_realtime_hazards(region=region)
    
    # Filter cyclones within bounds
    filtered_cyclones = [
        c for c in all_hazards.get("cyclones", [])
        if bounds["minLat"] <= c["center"]["lat"] <= bounds["maxLat"]
        and bounds["minLon"] <= c["center"]["lon"] <= bounds["maxLon"]
    ]
    
    return {
        "success": True,
        "region": region,
        "bounds": bounds,
        "cyclones": filtered_cyclones,
        "floods": all_hazards.get("floods", []),
        "landslides": all_hazards.get("landslides", []),
        "waterlogged": all_hazards.get("waterlogged", []),
        "lastUpdated": all_hazards.get("lastUpdated"),
    }


@router.get("/health")
async def hazards_health() -> Dict[str, Any]:
    """Health check for hazards API."""
    return {
        "status": "healthy",
        "detectors_available": DETECTORS_AVAILABLE,
        "cyclone_detector": cyclone_detector is not None,
        "flood_detector": flood_detector is not None,
        "landslide_calculator": landslide_calculator is not None,
        "timestamp": datetime.utcnow().isoformat(),
    }

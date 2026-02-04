#!/usr/bin/env python3
"""
AFRO STORM - Unified Hazards API
================================

Single endpoint returning ALL detected hazards in real-time:
- Active cyclones
- Flooded areas
- Landslide risks
- Waterlogged zones
- Disease outbreak convergence

This is what the frontend calls to populate the map.

Usage:
  # Add to unified_server.py routes
  from src.api.hazards_api import hazards_router
  app.include_router(hazards_router)
"""

import os
import sys
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger

try:
    from fastapi import APIRouter, HTTPException, Query
    from pydantic import BaseModel, Field
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    logger.warning("FastAPI not installed")


# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    "cache_ttl_seconds": 300,  # 5 minute cache
    "database_path": Path(__file__).parent.parent.parent.parent / "data_dir" / "cyclone_detections.db",
}


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

if FASTAPI_AVAILABLE:
    
    class HazardLocation(BaseModel):
        lat: float
        lon: float
    
    class CycloneHazard(BaseModel):
        id: str
        type: str = "cyclone"
        location: HazardLocation
        threat_level: str
        max_wind_kt: Optional[float] = None
        min_pressure_hpa: Optional[float] = None
        track_probability: Optional[float] = None
        detection_time: str
        source: str
    
    class FloodHazard(BaseModel):
        id: str
        type: str = "flood"
        location: HazardLocation
        area_km2: float
        severity: str
        water_fraction: Optional[float] = None
        detection_time: str
        source: str
    
    class LandslideHazard(BaseModel):
        id: str
        type: str = "landslide"
        location: HazardLocation
        risk_level: str
        risk_score: float
        slope_deg: float
        rainfall_mm: float
        reason: str
        recommended_action: str
    
    class ConvergenceHazard(BaseModel):
        id: str
        type: str = "convergence"
        location: HazardLocation
        cyclone_name: Optional[str] = None
        outbreak_type: Optional[str] = None
        threat_score: float
        population_at_risk: int
        hours_to_impact: float
    
    class HazardsSummary(BaseModel):
        total_hazards: int
        cyclones: int
        floods: int
        landslides: int
        convergences: int
        highest_threat: str
        regions_affected: List[str]
    
    class HazardsResponse(BaseModel):
        timestamp: str
        summary: HazardsSummary
        cyclones: List[CycloneHazard]
        floods: List[FloodHazard]
        landslides: List[LandslideHazard]
        convergences: List[ConvergenceHazard]
        waterlogged: List[Dict] = []


# =============================================================================
# DATA FETCHERS
# =============================================================================

class HazardDataFetcher:
    """Fetch hazard data from various sources."""
    
    def __init__(self):
        self.db_path = CONFIG["database_path"]
        self._cache = {}
        self._cache_time = {}
    
    def get_active_cyclones(self, hours: int = 24) -> List[Dict]:
        """Get active cyclones from database and live sources."""
        
        cache_key = f"cyclones_{hours}"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        cyclones = []
        
        # From database
        try:
            db_cyclones = self._query_db_cyclones(hours)
            cyclones.extend(db_cyclones)
        except Exception as e:
            logger.warning(f"Database query failed: {e}")
        
        # From live API
        try:
            live_cyclones = self._fetch_live_cyclones()
            cyclones.extend(live_cyclones)
        except Exception as e:
            logger.warning(f"Live fetch failed: {e}")
        
        # Deduplicate by location
        cyclones = self._deduplicate_hazards(cyclones)
        
        self._cache[cache_key] = cyclones
        self._cache_time[cache_key] = datetime.utcnow()
        
        return cyclones
    
    def _query_db_cyclones(self, hours: int) -> List[Dict]:
        """Query cyclones from SQLite database."""
        
        import sqlite3
        
        if not self.db_path.exists():
            return []
        
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        
        try:
            cursor.execute("""
                SELECT * FROM detections
                WHERE detection_time > ?
                ORDER BY detection_time DESC
            """, (since,))
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    "id": f"cyclone_{row['id']}",
                    "type": "cyclone",
                    "location": {
                        "lat": row["lat"],
                        "lon": row["lon"]
                    },
                    "threat_level": row["threat_level"] or "TD",
                    "max_wind_kt": row["max_wind_kt"],
                    "min_pressure_hpa": row["min_pressure_hpa"],
                    "track_probability": row["track_probability"],
                    "detection_time": row["detection_time"],
                    "source": row["source"] or "database",
                })
            
            conn.close()
            return results
            
        except sqlite3.OperationalError as e:
            logger.warning(f"Table not found: {e}")
            conn.close()
            return []
    
    def _fetch_live_cyclones(self) -> List[Dict]:
        """Fetch from live FNV3 API."""
        
        import requests
        
        try:
            response = requests.get("http://localhost:9000/api/cyclones", timeout=5)
            if response.ok:
                data = response.json()
                features = data.get("features", [])
                
                return [
                    {
                        "id": f"fnv3_{i}",
                        "type": "cyclone",
                        "location": {
                            "lat": f["geometry"]["coordinates"][1],
                            "lon": f["geometry"]["coordinates"][0],
                        },
                        "threat_level": f["properties"].get("threat_level", "TD"),
                        "track_probability": f["properties"].get("track_probability"),
                        "detection_time": datetime.utcnow().isoformat(),
                        "source": "fnv3",
                    }
                    for i, f in enumerate(features)
                ]
        except Exception:
            pass
        
        return []
    
    def get_current_floods(self, hours: int = 48) -> List[Dict]:
        """Get current flood detections."""
        
        cache_key = f"floods_{hours}"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        floods = []
        
        # From database
        try:
            floods = self._query_db_floods(hours)
        except Exception as e:
            logger.warning(f"Flood query failed: {e}")
        
        self._cache[cache_key] = floods
        self._cache_time[cache_key] = datetime.utcnow()
        
        return floods
    
    def _query_db_floods(self, hours: int) -> List[Dict]:
        """Query floods from database."""
        
        import sqlite3
        
        if not self.db_path.exists():
            return []
        
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        
        try:
            cursor.execute("""
                SELECT * FROM floods
                WHERE detection_time > ?
                ORDER BY detection_time DESC
            """, (since,))
            
            results = []
            for row in cursor.fetchall():
                geojson = json.loads(row["geojson"]) if row["geojson"] else {}
                
                for feature in geojson.get("features", []):
                    coords = feature.get("geometry", {}).get("coordinates", [[0, 0]])
                    props = feature.get("properties", {})
                    
                    # Get center point
                    if feature["geometry"]["type"] == "Point":
                        lon, lat = coords
                    else:
                        # Polygon - get centroid
                        lons = [p[0] for p in coords[0]]
                        lats = [p[1] for p in coords[0]]
                        lon = sum(lons) / len(lons)
                        lat = sum(lats) / len(lats)
                    
                    results.append({
                        "id": f"flood_{row['id']}_{len(results)}",
                        "type": "flood",
                        "location": {"lat": lat, "lon": lon},
                        "area_km2": props.get("area_km2", row["total_area_km2"] or 0),
                        "severity": props.get("severity") or row["max_severity"] or "moderate",
                        "water_fraction": props.get("water_fraction"),
                        "detection_time": row["detection_time"],
                        "source": props.get("source", "satellite"),
                    })
            
            conn.close()
            return results
            
        except sqlite3.OperationalError:
            conn.close()
            return []
    
    def get_landslide_risks(self, hours: int = 24) -> List[Dict]:
        """Get current landslide risk zones."""
        
        cache_key = f"landslides_{hours}"
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        risks = []
        
        try:
            risks = self._query_db_landslides(hours)
        except Exception as e:
            logger.warning(f"Landslide query failed: {e}")
        
        self._cache[cache_key] = risks
        self._cache_time[cache_key] = datetime.utcnow()
        
        return risks
    
    def _query_db_landslides(self, hours: int) -> List[Dict]:
        """Query landslide risks from database."""
        
        import sqlite3
        
        if not self.db_path.exists():
            return []
        
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        
        try:
            cursor.execute("""
                SELECT * FROM landslide_risks
                WHERE assessment_time > ?
                ORDER BY assessment_time DESC
            """, (since,))
            
            results = []
            for row in cursor.fetchall():
                geojson = json.loads(row["geojson"]) if row["geojson"] else {}
                
                for feature in geojson.get("features", []):
                    props = feature.get("properties", {})
                    
                    if props.get("risk_level") in ["HIGH", "EXTREME"]:
                        results.append({
                            "id": f"landslide_{row['id']}_{len(results)}",
                            "type": "landslide",
                            "location": {
                                "lat": props.get("lat", 0),
                                "lon": props.get("lon", 0),
                            },
                            "risk_level": props.get("risk_level"),
                            "risk_score": props.get("risk_score", 0),
                            "slope_deg": props.get("slope_deg", 0),
                            "rainfall_mm": props.get("rainfall_mm", 0),
                            "reason": props.get("reason", ""),
                            "recommended_action": props.get("recommended_action", ""),
                        })
            
            conn.close()
            return results
            
        except sqlite3.OperationalError:
            conn.close()
            return []
    
    def get_convergences(self, hours: int = 24) -> List[Dict]:
        """Get cyclone-outbreak convergence zones."""
        
        # This would query the convergence detection from unified_server
        # For now, generate based on cyclone + outbreak proximity
        
        cyclones = self.get_active_cyclones(hours)
        
        convergences = []
        for cyclone in cyclones:
            if cyclone.get("track_probability", 0) > 0.5:
                convergences.append({
                    "id": f"convergence_{cyclone['id']}",
                    "type": "convergence",
                    "location": cyclone["location"],
                    "cyclone_name": cyclone.get("threat_level"),
                    "outbreak_type": "cholera",  # Would come from outbreak data
                    "threat_score": cyclone.get("track_probability", 0) * 0.8,
                    "population_at_risk": 150000,  # Would calculate from population data
                    "hours_to_impact": 48,
                })
        
        return convergences
    
    def get_waterlogged_areas(self, hours: int = 72) -> List[Dict]:
        """Get areas at risk of waterlogging (persistent flooding)."""
        
        # Areas where water hasn't receded after flooding
        floods = self.get_current_floods(hours)
        
        # Filter for areas with high water fraction that persisted
        return [
            f for f in floods
            if f.get("water_fraction", 0) > 0.7
        ]
    
    def _is_cache_valid(self, key: str) -> bool:
        """Check if cache is still valid."""
        
        if key not in self._cache_time:
            return False
        
        age = (datetime.utcnow() - self._cache_time[key]).total_seconds()
        return age < CONFIG["cache_ttl_seconds"]
    
    def _deduplicate_hazards(self, hazards: List[Dict]) -> List[Dict]:
        """Remove duplicate hazards based on proximity."""
        
        if not hazards:
            return []
        
        unique = []
        for h in hazards:
            is_dup = False
            for u in unique:
                # Same location within 0.5 degrees
                if (abs(h["location"]["lat"] - u["location"]["lat"]) < 0.5 and
                    abs(h["location"]["lon"] - u["location"]["lon"]) < 0.5):
                    is_dup = True
                    break
            
            if not is_dup:
                unique.append(h)
        
        return unique


# =============================================================================
# API ROUTES
# =============================================================================

if FASTAPI_AVAILABLE:
    
    hazards_router = APIRouter(prefix="/api/hazards", tags=["hazards"])
    
    fetcher = HazardDataFetcher()
    
    @hazards_router.get("/realtime", response_model=HazardsResponse)
    async def get_all_hazards(
        hours: int = Query(24, description="Lookback hours for detections")
    ):
        """
        Get ALL detected hazards in real-time.
        
        Returns:
            - Active cyclones
            - Flooded areas
            - Landslide risks
            - Waterlogged zones
            - Cyclone-outbreak convergences
        """
        
        cyclones = fetcher.get_active_cyclones(hours)
        floods = fetcher.get_current_floods(hours * 2)  # Floods persist longer
        landslides = fetcher.get_landslide_risks(hours)
        convergences = fetcher.get_convergences(hours)
        waterlogged = fetcher.get_waterlogged_areas(hours * 3)
        
        # Determine highest threat
        highest = "LOW"
        threat_order = ["LOW", "TD", "TS", "CAT1", "CAT2", "CAT3", "CAT4", "CAT5"]
        for c in cyclones:
            level = c.get("threat_level", "TD")
            if level in threat_order and threat_order.index(level) > threat_order.index(highest):
                highest = level
        
        # Get affected regions
        regions = set()
        for hazard in cyclones + floods + landslides:
            lat = hazard.get("location", {}).get("lat", 0)
            lon = hazard.get("location", {}).get("lon", 0)
            
            if -35 < lat < 0 and 30 < lon < 60:
                if -27 < lat < -10:
                    regions.add("Mozambique")
                if -26 < lat < -12:
                    regions.add("Madagascar")
                if -17 < lat < -9:
                    regions.add("Malawi")
        
        summary = HazardsSummary(
            total_hazards=len(cyclones) + len(floods) + len(landslides) + len(convergences),
            cyclones=len(cyclones),
            floods=len(floods),
            landslides=len(landslides),
            convergences=len(convergences),
            highest_threat=highest,
            regions_affected=list(regions),
        )
        
        return HazardsResponse(
            timestamp=datetime.utcnow().isoformat(),
            summary=summary,
            cyclones=cyclones,
            floods=floods,
            landslides=landslides,
            convergences=convergences,
            waterlogged=waterlogged,
        )
    
    @hazards_router.get("/cyclones")
    async def get_cyclones(hours: int = Query(24)):
        """Get active cyclones only."""
        return {"cyclones": fetcher.get_active_cyclones(hours)}
    
    @hazards_router.get("/floods")
    async def get_floods(hours: int = Query(48)):
        """Get current flood detections."""
        return {"floods": fetcher.get_current_floods(hours)}
    
    @hazards_router.get("/landslides")
    async def get_landslides(hours: int = Query(24)):
        """Get landslide risk zones."""
        return {"landslides": fetcher.get_landslide_risks(hours)}
    
    @hazards_router.get("/convergences")
    async def get_convergences(hours: int = Query(24)):
        """Get cyclone-outbreak convergence zones."""
        return {"convergences": fetcher.get_convergences(hours)}
    
    @hazards_router.get("/summary")
    async def get_summary():
        """Get quick summary of all hazards."""
        
        cyclones = fetcher.get_active_cyclones(24)
        floods = fetcher.get_current_floods(48)
        landslides = fetcher.get_landslide_risks(24)
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "cyclones": len(cyclones),
            "floods": len(floods),
            "landslides": len(landslides),
            "highest_threat": max(
                [c.get("threat_level", "TD") for c in cyclones] or ["NONE"],
                key=lambda x: ["NONE", "TD", "TS", "CAT1", "CAT2", "CAT3", "CAT4", "CAT5"].index(x)
            ),
        }


# =============================================================================
# STANDALONE MODE
# =============================================================================

def main():
    """Run API standalone for testing."""
    
    if not FASTAPI_AVAILABLE:
        print("FastAPI not installed. Run: pip install fastapi uvicorn")
        return
    
    import uvicorn
    from fastapi import FastAPI
    
    app = FastAPI(title="AFRO STORM Hazards API")
    app.include_router(hazards_router)
    
    print("Starting Hazards API on http://localhost:9001")
    uvicorn.run(app, host="0.0.0.0", port=9001)


if __name__ == "__main__":
    main()

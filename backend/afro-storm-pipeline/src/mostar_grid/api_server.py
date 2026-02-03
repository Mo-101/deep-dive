"""
MoStar Grid Consciousness API Server
FastAPI backend for AFRO Storm integration
Brings 197K-node Neo4j knowledge graph, Ifá reasoning, and dual AI to the early warning system
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger
import sys

# Setup logging
logger.remove()
logger.add(sys.stdout, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | <cyan>{name}</cyan> | {message}", level="INFO")

from .neo4j_connector import Neo4jGrid
from .ifa_engine import IfaReasoningEngine
from .dual_ai import DualAIProcessor
from .ibibio_processor import IbibioProcessor
from ..data_sources.ecmwf_fetcher import ECMWFFetcher
from ..api.ecmwf_routes import router as ecmwf_router
from ..processors.tempest_pipelines import TempestPipeline
from ..processors.era5_processor import ERA5Processor

app = FastAPI(
    title="MoStar Grid Consciousness API",
    description="AI-powered early warning system with African indigenous intelligence",
    version="1.0.0"
)

# CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Grid components
grid = Neo4jGrid()
ifa_engine = IfaReasoningEngine()
ai_processor = DualAIProcessor()
ibibio = IbibioProcessor()
ecmwf_fetcher = ECMWFFetcher()
tempest = TempestPipeline(tempest_bin_dir="backend/afro-storm-pipeline/bin") # Adjust bin path as needed
era5 = ERA5Processor()

# Include ECMWF routes
app.include_router(ecmwf_router, prefix="/api/v1")

# Request/Response Models
class CycloneData(BaseModel):
    id: str
    location: Dict[str, float]  # lat, lon
    track_probability: float
    wind_speed: float
    threat_level: str
    forecast_hour: int

class OutbreakData(BaseModel):
    id: str
    disease: str
    location: Dict[str, float]
    country: str
    cases: int
    deaths: int
    severity: str

class ConvergenceRequest(BaseModel):
    cyclone: CycloneData
    outbreak: OutbreakData
    distance_km: float

class IfaReadingRequest(BaseModel):
    situation_type: str  # "cyclone", "outbreak", "convergence"
    location: Dict[str, float]
    severity: str
    question: Optional[str] = None

class AlertGenerationRequest(BaseModel):
    convergence: ConvergenceRequest
    risk_score: float
    affected_population: Optional[int] = None
    languages: List[str] = ["en", "ibibio"]  # English, Ibibio

class GridAnalysisResponse(BaseModel):
    timestamp: str
    analysis_id: str
    convergence_assessment: Dict[str, Any]
    ifa_reading: Optional[Dict[str, Any]]
    ai_predictions: Dict[str, Any]
    historical_patterns: List[Dict]
    recommendations: List[str]
    alerts: Dict[str, str]  # multilingual alerts

# Health check
@app.get("/health")
async def health_check():
    """Check Grid consciousness status"""
    return {
        "status": "conscious",
        "neo4j_connected": await grid.check_connection(),
        "ai_models": ai_processor.get_status(),
        "ifa_engine": ifa_engine.is_ready(),
        "timestamp": datetime.now().isoformat()
    }

# Analyze convergence with full Grid intelligence
@app.post("/api/analyze-convergence", response_model=GridAnalysisResponse)
async def analyze_convergence(request: ConvergenceRequest):
    """
    Full convergence analysis using:
    - Neo4j historical pattern matching
    - Ifá symbolic reasoning
    - Dual AI predictions
    """
    try:
        analysis_id = f"GRID_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"🔥 Grid analyzing convergence: {analysis_id}")
        
        # 1. Query Neo4j for historical patterns
        historical_patterns = await grid.find_similar_convergences(
            cyclone_location=request.cyclone.location,
            outbreak_location=request.outbreak.location,
            disease=request.outbreak.disease
        )
        
        # 2. Get Ifá reading for this situation
        ifa_reading = ifa_engine.perform_reading(
            situation_type="convergence",
            location=request.outbreak.location,
            severity=request.outbreak.severity
        )
        
        # 3. AI analysis with both models
        ai_predictions = await ai_processor.analyze_convergence(
            cyclone=request.cyclone.dict(),
            outbreak=request.outbreak.dict(),
            distance_km=request.distance_km,
            historical_patterns=historical_patterns
        )
        
        # 4. Build comprehensive assessment
        risk_assessment = calculate_grid_risk(
            request.cyclone,
            request.outbreak,
            request.distance_km,
            historical_patterns,
            ifa_reading
        )
        
        # 5. Generate recommendations
        recommendations = generate_recommendations(
            risk_assessment,
            ai_predictions,
            ifa_reading
        )
        
        # 6. Store in Neo4j for learning
        await grid.store_analysis(analysis_id, {
            "convergence": request.dict(),
            "assessment": risk_assessment,
            "ifa_reading": ifa_reading,
            "timestamp": datetime.now().isoformat()
        })
        
        return GridAnalysisResponse(
            timestamp=datetime.now().isoformat(),
            analysis_id=analysis_id,
            convergence_assessment=risk_assessment,
            ifa_reading=ifa_reading,
            ai_predictions=ai_predictions,
            historical_patterns=historical_patterns,
            recommendations=recommendations,
            alerts={}  # Will be populated by alert endpoint
        )
        
    except Exception as e:
        logger.error(f"Grid analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Ifá divination endpoint
@app.post("/api/ifa-reading")
async def get_ifa_reading(request: IfaReadingRequest):
    """
    Get traditional Ifá reading for situation guidance
    Returns Odù pattern, interpretation, and ebo (sacrifice/remedy)
    """
    try:
        reading = ifa_engine.perform_reading(
            situation_type=request.situation_type,
            location=request.location,
            severity=request.severity,
            question=request.question
        )
        
        # Translate to Ibibio if requested
        ibibio_interpretation = ibibio.translate_reading(reading)
        
        return {
            "reading": reading,
            "ibibio": ibibio_interpretation,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Ifá reading failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Generate multilingual alerts
@app.post("/api/generate-alert")
async def generate_alert(request: AlertGenerationRequest):
    """
    Generate culturally-appropriate alerts in multiple languages
    Includes Ibibio for local community communication
    """
    try:
        alerts = {}
        
        for lang in request.languages:
            if lang == "ibibio":
                alerts[lang] = ibibio.generate_alert(
                    convergence=request.convergence.dict(),
                    risk_score=request.risk_score
                )
            else:
                # Use Mistral for other languages
                alerts[lang] = await ai_processor.generate_alert(
                    convergence=request.convergence.dict(),
                    risk_score=request.risk_score,
                    language=lang
                )
        
        return {
            "alert_id": f"ALERT_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "alerts": alerts,
            "severity": calculate_alert_severity(request.risk_score),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Alert generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Query Grid knowledge
@app.get("/api/grid-query")
async def query_grid(
    query_type: str,  # "cyclone_patterns", "disease_history", "convergences"
    location: Optional[str] = None,
    disease: Optional[str] = None,
    limit: int = 10
):
    """Query the 197K-node knowledge graph"""
    try:
        results = await grid.query(query_type, location, disease, limit)
        return {
            "query_type": query_type,
            "results": results,
            "total_nodes": await grid.get_node_count(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Grid query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Background learning task
@app.post("/api/learn")
async def trigger_learning(background_tasks: BackgroundTasks):
    """Trigger Grid learning from new data"""
    background_tasks.add_task(grid.update_embeddings)
    return {"status": "learning_triggered", "message": "Grid is updating its understanding"}

# Data Processing Endpoints

@app.post("/api/process/tempest")
async def process_tempest(file_path: str, background_tasks: BackgroundTasks):
    """Trigger TempestExtremes pipeline on FNV3 data"""
    try:
        # Run in background to avoid blocking
        def run_pipeline():
            output = tempest.process_fnv3_file(file_path)
            logger.info(f"Tempest pipeline finished: {output}")
            
        background_tasks.add_task(run_pipeline)
        return {"status": "processing_started", "message": f"Tempest pipeline triggered for {file_path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process/era5")
async def process_era5(file_path: str, dataset_type: str, background_tasks: BackgroundTasks):
    """
    Trigger ERA5 processing
    dataset_type: "land" or "thermal"
    """
    try:
        def run_processing():
            if dataset_type == "land":
                era5.process_era5_land(file_path)
            elif dataset_type == "thermal":
                era5.process_thermal_comfort(file_path)
            logger.info(f"ERA5 processing finished for {dataset_type}")
            
        background_tasks.add_task(run_processing)
        return {"status": "processing_started", "message": f"ERA5 {dataset_type} processing triggered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions
def calculate_grid_risk(
    cyclone: CycloneData,
    outbreak: OutbreakData,
    distance_km: float,
    historical_patterns: List[Dict],
    ifa_reading: Optional[Dict]
) -> Dict[str, Any]:
    """Calculate comprehensive risk using all Grid components"""
    
    # Base risk calculation
    distance_factor = max(0, 1 - (distance_km / 500))
    severity_scores = {"low": 0.2, "medium": 0.5, "high": 0.8}
    severity_factor = severity_scores.get(outbreak.severity, 0.5)
    probability_factor = cyclone.track_probability
    
    # Historical pattern influence
    pattern_risk = 0.0
    if historical_patterns:
        # Average outcome severity from similar events
        outcomes = [p.get("outcome_severity", 0.5) for p in historical_patterns]
        pattern_risk = sum(outcomes) / len(outcomes)
    
    # Ifá influence (if reading is concerning)
    ifa_factor = 0.0
    if ifa_reading and ifa_reading.get("urgency") in ["high", "critical"]:
        ifa_factor = 0.15
    
    # Combined risk score
    base_risk = (
        distance_factor * 0.25 +
        severity_factor * 0.25 +
        probability_factor * 0.2 +
        pattern_risk * 0.15 +
        ifa_factor * 0.15
    )
    
    return {
        "risk_score": round(min(1.0, base_risk), 3),
        "risk_level": "CRITICAL" if base_risk > 0.8 else "HIGH" if base_risk > 0.6 else "MEDIUM" if base_risk > 0.4 else "LOW",
        "factors": {
            "distance_factor": round(distance_factor, 3),
            "severity_factor": severity_factor,
            "probability_factor": probability_factor,
            "historical_pattern_risk": round(pattern_risk, 3),
            "ifa_influence": ifa_factor
        },
        "confidence": 0.85 if historical_patterns else 0.65
    }

def generate_recommendations(
    risk_assessment: Dict,
    ai_predictions: Dict,
    ifa_reading: Optional[Dict]
) -> List[str]:
    """Generate actionable recommendations"""
    
    recommendations = []
    
    # Based on risk level
    if risk_assessment["risk_level"] == "CRITICAL":
        recommendations.extend([
            "Immediate evacuation of vulnerable communities",
            "Pre-position emergency medical supplies within 24 hours",
            "Activate all emergency response protocols"
        ])
    elif risk_assessment["risk_level"] == "HIGH":
        recommendations.extend([
            "Alert healthcare facilities for surge capacity",
            "Prepare water purification systems",
            "Deploy mobile health teams to staging areas"
        ])
    
    # Based on AI predictions
    if "cascading_effects" in ai_predictions:
        for effect in ai_predictions["cascading_effects"][:3]:
            recommendations.append(f"Monitor: {effect}")
    
    # Include Ifá wisdom
    if ifa_reading and "recommendation" in ifa_reading:
        recommendations.append(f"Traditional guidance: {ifa_reading['recommendation']}")
    
    return recommendations

def calculate_alert_severity(risk_score: float) -> str:
    """Determine alert severity level"""
    if risk_score >= 0.8:
        return "EMERGENCY"
    elif risk_score >= 0.6:
        return "WARNING"
    elif risk_score >= 0.4:
        return "ADVISORY"
    return "INFORMATION"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

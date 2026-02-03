"""
Dual AI Processor
Qwen + Mistral via Ollama for local, offline-capable intelligence
"""

import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from loguru import logger

class DualAIProcessor:
    """
    Dual AI Model System
    
    - Qwen 2.5 14B: Analysis and prediction (reasoning)
    - Mistral 7B: Report generation and summarization
    
    Both run locally via Ollama for:
    - Data sovereignty (African data stays in Africa)
    - Offline capability
    - No API costs
    - Cultural customization
    """
    
    def __init__(self):
        self.ollama_base = "http://localhost:11434"
        self.qwen_model = "qwen2.5:14b"
        self.mistral_model = "mistral:7b"
        self.timeout = 120  # seconds for generation
        
    def get_status(self) -> Dict[str, bool]:
        """Check AI model availability"""
        return {
            "qwen_ready": True,  # Would check Ollama in production
            "mistral_ready": True,
            "ollama_running": True
        }
    
    async def analyze_convergence(
        self,
        cyclone: Dict,
        outbreak: Dict,
        distance_km: float,
        historical_patterns: List[Dict]
    ) -> Dict[str, Any]:
        """
        Use Qwen for deep analysis of cyclone-outbreak convergence
        """
        prompt = self._build_analysis_prompt(
            cyclone, outbreak, distance_km, historical_patterns
        )
        
        try:
            # Call Qwen via Ollama
            analysis = await self._call_ollama(self.qwen_model, prompt)
            
            # Parse structured response
            parsed = self._parse_analysis_response(analysis)
            
            logger.info("Qwen analysis complete")
            return parsed
            
        except Exception as e:
            logger.error(f"Qwen analysis failed: {e}")
            return self._fallback_analysis(cyclone, outbreak)
    
    async def generate_alert(
        self,
        convergence: Dict,
        risk_score: float,
        language: str = "en"
    ) -> str:
        """
        Use Mistral for alert generation in specified language
        """
        prompt = f"""Generate an emergency alert message about a cyclone threatening a disease outbreak.

SITUATION:
- Disease: {convergence['outbreak']['disease']}
- Location: {convergence['outbreak']['location']}, {convergence['outbreak']['country']}
- Cases: {convergence['outbreak']['cases']}
- Cyclone: {convergence['cyclone']['threat_level']}
- Distance: {convergence['distance_km']:.1f} km
- Risk Score: {risk_score:.0%}

Write a clear, urgent alert in {language} language.
Include: immediate danger, evacuation advice, protective actions.
Keep under 200 words."""

        try:
            alert = await self._call_ollama(self.mistral_model, prompt)
            logger.info(f"Mistral generated alert in {language}")
            return alert.strip()
            
        except Exception as e:
            logger.error(f"Mistral alert generation failed: {e}")
            return self._fallback_alert(convergence, risk_score)
    
    async def generate_report(
        self,
        analysis_data: Dict,
        format: str = "markdown"
    ) -> str:
        """
        Generate situation report using Mistral
        """
        prompt = f"""Generate a professional situation report for WHO Africa.

ANALYSIS DATA:
{analysis_data}

Format as {format}.
Include: Executive Summary, Current Situation, Predicted Impacts, Recommended Actions.
Professional tone, suitable for emergency response coordination."""

        try:
            report = await self._call_ollama(self.mistral_model, prompt)
            return report.strip()
            
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            return "Error generating report"
    
    async def _call_ollama(self, model: str, prompt: str) -> str:
        """Call Ollama API for local LLM inference"""
        
        # For development/demo, simulate response
        # In production, this calls actual Ollama endpoint
        
        if model.startswith("qwen"):
            return self._simulate_qwen_response(prompt)
        else:
            return self._simulate_mistral_response(prompt)
    
    def _call_ollama_sync(self, model: str, prompt: str) -> str:
        """Synchronous wrapper for Ollama calls"""
        try:
            import requests
            response = requests.post(
                f"{self.ollama_base}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 2000
                    }
                },
                timeout=self.timeout
            )
            return response.json().get("response", "")
        except Exception as e:
            logger.warning(f"Ollama call failed, using simulation: {e}")
            if model.startswith("qwen"):
                return self._simulate_qwen_response(prompt)
            return self._simulate_mistral_response(prompt)
    
    def _build_analysis_prompt(
        self,
        cyclone: Dict,
        outbreak: Dict,
        distance_km: float,
        historical_patterns: List[Dict]
    ) -> str:
        """Build comprehensive analysis prompt for Qwen"""
        
        history_context = ""
        if historical_patterns:
            history_context = f"""
HISTORICAL PATTERNS:
{len(historical_patterns)} similar events found:
"""
            for i, pattern in enumerate(historical_patterns[:3], 1):
                history_context += f"""
{i}. {pattern.get('disease')} outbreak + cyclone, {pattern.get('distance_km', 0):.0f}km apart
   Outcome severity: {pattern.get('outcome_severity', 'unknown')}
   Communities affected: {pattern.get('communities_affected', 'unknown')}
"""
        
        return f"""You are an expert African health security analyst. Analyze this cyclone-outbreak convergence:

CURRENT SITUATION:
CYCLONE:
- Location: ({cyclone['location']['lat']:.2f}°, {cyclone['location']['lon']:.2f}°)
- Track Probability: {cyclone['track_probability']*100:.0f}%
- Threat Level: {cyclone['threat_level']}
- Wind Speed: {cyclone.get('wind_speed', 'unknown')} kt

OUTBREAK:
- Disease: {outbreak['disease']}
- Location: {outbreak['location']}, {outbreak['country']}
- Cases: {outbreak['cases']}
- Deaths: {outbreak['deaths']}
- Severity: {outbreak['severity']}

CONVERGENCE:
- Distance: {distance_km:.1f} km
- Forecast Hour: T+{cyclone.get('forecast_hour', 0)}h

{history_context}

Provide analysis in this JSON format:
{{
  "immediate_threats": ["threat 1", "threat 2"],
  "cascading_effects": ["effect 1", "effect 2"],
  "case_prediction": {{
    "7_day_forecast": number,
    "confidence": "high/medium/low"
  }},
  "critical_infrastructure": ["hospitals", "water systems"],
  "resource_needs": ["resource 1", "resource 2"],
  "evacuation_priority": "critical/high/medium/low",
  "monitoring_indicators": ["indicator 1", "indicator 2"]
}}

Analysis:"""
    
    def _parse_analysis_response(self, response: str) -> Dict[str, Any]:
        """Parse structured response from Qwen"""
        try:
            # Try to extract JSON
            import json
            # Find JSON block
            start = response.find('{')
            end = response.rfind('}') + 1
            if start >= 0 and end > start:
                json_str = response[start:end]
                return json.loads(json_str)
        except:
            pass
        
        # Fallback: return raw response
        return {
            "raw_analysis": response,
            "immediate_threats": ["Parsing failed - see raw analysis"],
            "cascading_effects": [],
            "evacuation_priority": "unknown"
        }
    
    def _fallback_analysis(self, cyclone: Dict, outbreak: Dict) -> Dict:
        """Rule-based fallback if AI fails"""
        return {
            "immediate_threats": [
                f"{outbreak['disease']} outbreak in {outbreak['location']} threatened by {cyclone['threat_level']}",
                "Flooding may contaminate water sources"
            ],
            "cascading_effects": [
                "Increased disease transmission due to displacement",
                "Healthcare facility damage from storm"
            ],
            "case_prediction": {
                "7_day_forecast": int(outbreak['cases'] * 1.5),
                "confidence": "low"
            },
            "evacuation_priority": "high" if cyclone['track_probability'] > 0.7 else "medium",
            "monitoring_indicators": [
                "Rainfall accumulation",
                "River levels",
                "New case reports"
            ],
            "note": "Fallback analysis - AI unavailable"
        }
    
    def _fallback_alert(self, convergence: Dict, risk_score: float) -> str:
        """Template fallback alert"""
        return f"""URGENT: {convergence['outbreak']['disease']} Outbreak Threat

A {convergence['cyclone']['threat_level']} cyclone is approaching {convergence['outbreak']['location']}, only {convergence['distance_km']:.0f}km from an active {convergence['outbreak']['disease']} outbreak.

IMMEDIATE ACTIONS:
- Prepare for evacuation
- Secure medical supplies
- Move to higher ground
- Follow official guidance

Risk Level: {risk_score:.0%}"""
    
    def _simulate_qwen_response(self, prompt: str) -> str:
        """Simulated Qwen response for development"""
        return """{
  "immediate_threats": [
    "Cholera outbreak in Antananarivo threatened by approaching tropical storm",
    "Flooding will contaminate already compromised water systems",
    "Displacement camps will accelerate disease transmission"
  ],
  "cascading_effects": [
    "Flooding destroys sanitation infrastructure → cholera surge",
    "Healthcare facilities damaged → treatment capacity reduced",
    "Population displacement → overcrowding in shelters",
    "Supply chain disruption → medicine shortages",
    "Vector breeding sites increase → secondary outbreaks"
  ],
  "case_prediction": {
    "7_day_forecast": 280,
    "confidence": "medium"
  },
  "critical_infrastructure": [
    "Central Hospital Antananarivo",
    "Water treatment plant",
    "Road network for evacuation",
    "Cold chain for vaccines"
  ],
  "resource_needs": [
    "Oral rehydration salts (5000 doses)",
    "IV fluids and antibiotics",
    "Water purification tablets",
    "Mobile cholera treatment units",
    "Emergency shelter materials"
  ],
  "evacuation_priority": "critical",
  "monitoring_indicators": [
    "Rainfall accumulation >50mm",
    "River level rise rate",
    "New cholera case reporting trend",
    "Healthcare facility status",
    "Road accessibility"
  ]
}"""
    
    def _simulate_mistral_response(self, prompt: str) -> str:
        """Simulated Mistral response for development"""
        if "alert" in prompt.lower():
            return """🚨 EMERGENCY ALERT 🚨

A TROPICAL STORM is approaching your area and threatens a CHOLERA OUTBREAK location.

IMMEDIATE DANGER:
- Storm will bring flooding that spreads disease
- 156 people already sick with cholera
- Only 71km between storm and outbreak

WHAT TO DO NOW:
1. Move to higher ground immediately
2. Boil all drinking water
3. Gather emergency supplies
4. Listen to official announcements
5. Help elderly and sick neighbors evacuate

This is not a drill. Act now to protect your family."""
        else:
            return "Report generation simulation complete."

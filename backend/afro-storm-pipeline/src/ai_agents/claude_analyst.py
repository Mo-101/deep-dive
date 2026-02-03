"""
Claude AI Analysis Agent
Uses Anthropic's Claude for intelligent threat analysis and prediction
"""

import asyncio
from anthropic import AsyncAnthropic
from datetime import datetime
from typing import Dict, List, Optional
import json
from loguru import logger

from config.settings import config

class ClaudeAnalyst:
    """AI-powered threat analysis using Claude"""
    
    def __init__(self):
        self.client = AsyncAnthropic(api_key=config.ai.claude_api_key)
        self.model = config.ai.claude_model
        
    async def analyze_convergence(
        self,
        cyclone_data: List[Dict],
        outbreak_data: List[Dict],
        convergences: List[Dict]
    ) -> Dict:
        """
        Analyze climate-health convergence and generate insights
        """
        try:
            # Prepare context
            context = self._prepare_analysis_context(
                cyclone_data,
                outbreak_data,
                convergences
            )
            
            # Construct prompt
            prompt = f"""You are an expert in African health security and climate-related disease risk assessment. 

Analyze the following convergence between cyclone threats and disease outbreaks in the WHO African Region:

{context}

Provide a comprehensive analysis covering:

1. IMMEDIATE THREATS: Identify the most urgent convergence zones requiring immediate action
2. CASCADING RISKS: Explain how cyclone impacts (flooding, displacement, infrastructure damage) will affect disease spread
3. VULNERABLE POPULATIONS: Identify communities most at risk based on the convergence data
4. RESOURCE PRIORITIZATION: Recommend where to pre-position medical supplies and response teams
5. PREDICTIVE INSIGHTS: What secondary outbreaks are likely to emerge (e.g., cholera after flooding)?
6. EARLY WARNING SIGNALS: What indicators should we monitor closely in the next 24-72 hours?

Format your response as structured JSON with these keys:
{{
  "executive_summary": "2-3 sentence overview",
  "immediate_threats": [
    {{"location": "", "disease": "", "cyclone_threat": "", "action_required": "", "priority": "CRITICAL|HIGH|MEDIUM"}}
  ],
  "cascading_risks": [
    {{"primary_threat": "", "secondary_impacts": [""], "timeline": "", "mitigation": ""}}
  ],
  "resource_recommendations": [
    {{"location": "", "resources": [""], "justification": "", "timeframe": ""}}
  ],
  "predictive_warnings": [
    {{"predicted_event": "", "probability": "", "location": "", "prevention_actions": [""]}}
  ],
  "monitoring_indicators": [""],
  "confidence_score": 0.0-1.0
}}

Respond ONLY with valid JSON, no preamble or explanation."""

            logger.info("🤖 Claude analyzing convergence data...")
            
            # Call Claude
            message = await self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.3,  # Lower temp for analytical tasks
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Parse response
            response_text = message.content[0].text
            analysis = json.loads(response_text)
            
            # Add metadata
            analysis['metadata'] = {
                'analyzed_at': datetime.now().isoformat(),
                'model': self.model,
                'num_cyclones': len(cyclone_data),
                'num_outbreaks': len(outbreak_data),
                'num_convergences': len(convergences)
            }
            
            logger.success(f"✓ Claude analysis complete (confidence: {analysis.get('confidence_score', 'N/A')})")
            
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            logger.error(f"Raw response: {response_text[:500]}")
            return self._fallback_analysis(convergences)
            
        except Exception as e:
            logger.error(f"Error in Claude analysis: {e}")
            return self._fallback_analysis(convergences)
    
    def _prepare_analysis_context(
        self,
        cyclone_data: List[Dict],
        outbreak_data: List[Dict],
        convergences: List[Dict]
    ) -> str:
        """Prepare formatted context for Claude"""
        
        context = "=== CURRENT SITUATION ===\n\n"
        
        # Active cyclones
        context += f"ACTIVE CYCLONES: {len(cyclone_data)}\n"
        for c in cyclone_data[:5]:  # Top 5
            context += f"- Location: ({c['location']['lat']:.2f}, {c['location']['lon']:.2f}) | "
            context += f"Track Prob: {c['track_probability']*100:.1f}% | "
            context += f"Threat: {c['threat_level']}\n"
        
        context += f"\nDISEASE OUTBREAKS: {len(outbreak_data)}\n"
        for o in outbreak_data:
            context += f"- {o['disease']} in {o['location']}, {o['country']}: "
            context += f"{o['cases']} cases, {o['deaths']} deaths | "
            context += f"Severity: {o['severity'].upper()}\n"
        
        context += f"\n=== CONVERGENCE ZONES: {len(convergences)} ===\n\n"
        for conv in convergences:
            context += f"ZONE: {conv['outbreak']['location']}\n"
            context += f"  Disease: {conv['outbreak']['disease']} ({conv['outbreak']['cases']} cases)\n"
            context += f"  Cyclone: {conv['cyclone']['threat_level']} "
            context += f"({conv['cyclone']['probability']*100:.0f}% probability)\n"
            context += f"  Distance: {conv['distance_km']}km\n"
            context += f"  Risk Score: {conv['risk_score']}\n"
            context += f"  Priority: {conv['alert_priority']}\n\n"
        
        return context
    
    def _fallback_analysis(self, convergences: List[Dict]) -> Dict:
        """Simple rule-based analysis if Claude fails"""
        logger.warning("Using fallback analysis")
        
        high_priority = [c for c in convergences if c['alert_priority'] == 'HIGH']
        
        return {
            "executive_summary": f"Identified {len(convergences)} convergence zones, {len(high_priority)} requiring immediate attention.",
            "immediate_threats": [
                {
                    "location": c['outbreak']['location'],
                    "disease": c['outbreak']['disease'],
                    "cyclone_threat": c['cyclone']['threat_level'],
                    "action_required": "Pre-position medical supplies and evacuation resources",
                    "priority": c['alert_priority']
                }
                for c in high_priority[:3]
            ],
            "cascading_risks": [],
            "resource_recommendations": [],
            "predictive_warnings": [],
            "monitoring_indicators": [
                "Rainfall accumulation",
                "River levels",
                "Disease case reporting trends",
                "Healthcare facility status"
            ],
            "confidence_score": 0.6,
            "metadata": {
                "analyzed_at": datetime.now().isoformat(),
                "model": "rule_based_fallback",
                "note": "Claude API unavailable, using simplified analysis"
            }
        }
    
    async def generate_situation_report(
        self,
        analysis: Dict,
        cyclone_data: List[Dict],
        outbreak_data: List[Dict]
    ) -> str:
        """
        Generate human-readable situation report
        """
        try:
            # Create markdown report
            report = f"""# 🔥 AFRO STORM INTELLIGENCE REPORT
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}

## Executive Summary
{analysis.get('executive_summary', 'No summary available')}

**Confidence Score:** {analysis.get('confidence_score', 0.0):.0%}

---

## 🌪️ Active Cyclone Threats: {len(cyclone_data)}
"""
            
            for c in cyclone_data[:5]:
                report += f"\n- **Location:** ({c['location']['lat']:.2f}°, {c['location']['lon']:.2f}°)\n"
                report += f"  - Track Probability: {c['track_probability']*100:.0f}%\n"
                report += f"  - Wind Threat: {c['wind_34kt_probability']*100:.0f}% (34kt+)\n"
                report += f"  - Classification: {c['threat_level']}\n"
            
            report += f"""

## 🦠 Disease Outbreaks: {len(outbreak_data)}
"""
            
            for o in outbreak_data:
                report += f"\n- **{o['disease']}** - {o['location']}, {o['country']}\n"
                report += f"  - Cases: {o['cases']} | Deaths: {o['deaths']}\n"
                report += f"  - Severity: {o['severity'].upper()}\n"
                report += f"  - Date: {o['date'][:10]}\n"
            
            report += "\n---\n\n## ⚠️ IMMEDIATE THREATS\n\n"
            
            for threat in analysis.get('immediate_threats', []):
                report += f"""
### {threat.get('priority', 'HIGH')} PRIORITY: {threat.get('location', 'Unknown')}
- **Disease:** {threat.get('disease', 'Unknown')}
- **Cyclone Threat:** {threat.get('cyclone_threat', 'Unknown')}
- **Action Required:** {threat.get('action_required', 'Assess situation')}
"""
            
            report += "\n## 📊 CASCADING RISKS\n\n"
            
            for risk in analysis.get('cascading_risks', [])[:3]:
                report += f"""
**{risk.get('primary_threat', 'Unknown')}**
- Timeline: {risk.get('timeline', 'Unknown')}
- Secondary Impacts: {', '.join(risk.get('secondary_impacts', []))}
- Mitigation: {risk.get('mitigation', 'Assess locally')}
"""
            
            report += "\n## 📦 RESOURCE RECOMMENDATIONS\n\n"
            
            for rec in analysis.get('resource_recommendations', [])[:5]:
                report += f"""
**{rec.get('location', 'Unknown')}** ({rec.get('timeframe', 'ASAP')})
- Resources: {', '.join(rec.get('resources', []))}
- Justification: {rec.get('justification', 'Based on convergence analysis')}
"""
            
            report += "\n## 🔮 PREDICTIVE WARNINGS\n\n"
            
            for warning in analysis.get('predictive_warnings', []):
                report += f"""
**{warning.get('predicted_event', 'Unknown')}**
- Probability: {warning.get('probability', 'Unknown')}
- Location: {warning.get('location', 'Unknown')}
- Prevention: {', '.join(warning.get('prevention_actions', []))}
"""
            
            report += "\n## 📡 MONITORING INDICATORS\n\n"
            for indicator in analysis.get('monitoring_indicators', []):
                report += f"- {indicator}\n"
            
            report += f"""

---

**Generated by:** AFRO Storm Intelligence Pipeline  
**Analysis Model:** {analysis.get('metadata', {}).get('model', 'Unknown')}  
**Contact:** WHO AFRO Operations Support & Logistics

*This is an automated intelligence product. Human validation required for operational decisions.*
"""
            
            logger.success("✓ Generated situation report")
            return report
            
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return f"# Error Generating Report\n\n{str(e)}"
    
    async def predict_outbreak_evolution(
        self,
        outbreak: Dict,
        cyclone_forecast: List[Dict],
        historical_data: Optional[Dict] = None
    ) -> Dict:
        """
        Predict how an outbreak will evolve given cyclone impacts
        """
        try:
            prompt = f"""Analyze how this disease outbreak will likely evolve given the approaching cyclone:

OUTBREAK:
- Disease: {outbreak['disease']}
- Location: {outbreak['location']}, {outbreak['country']}
- Current cases: {outbreak['cases']}
- Current deaths: {outbreak['deaths']}
- Severity: {outbreak['severity']}

CYCLONE FORECAST:
- Threat level: {cyclone_forecast[0]['threat_level'] if cyclone_forecast else 'Unknown'}
- Probability: {cyclone_forecast[0]['track_probability']*100:.0f}% if cyclone_forecast else 0

Based on epidemiological principles and climate-health interactions, predict:
1. Case trajectory over next 7 days
2. Critical infrastructure impacts (hospitals, water, sanitation)
3. Population displacement estimates
4. Secondary disease risks
5. Recommended interventions

Respond as JSON with keys: prediction_summary, case_trajectory, infrastructure_impact, displacement_estimate, secondary_risks, interventions"""

            message = await self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}]
            )
            
            prediction = json.loads(message.content[0].text)
            prediction['generated_at'] = datetime.now().isoformat()
            
            return prediction
            
        except Exception as e:
            logger.error(f"Error in outbreak prediction: {e}")
            return {'error': str(e)}

# Example usage
async def main():
    """Test Claude analyst"""
    logger.info("🤖 Testing Claude AI analyst...")
    
    analyst = ClaudeAnalyst()
    
    # Sample data
    cyclones = [
        {
            'location': {'lat': -19.5, 'lon': 47.25},
            'track_probability': 1.0,
            'wind_34kt_probability': 1.0,
            'threat_level': 'TROPICAL_STORM'
        }
    ]
    
    outbreaks = [
        {
            'disease': 'Cholera',
            'country': 'Madagascar',
            'location': 'Antananarivo',
            'coordinates': [47.5, -18.9],
            'cases': 156,
            'deaths': 22,
            'date': datetime.now().isoformat(),
            'severity': 'high'
        }
    ]
    
    convergences = [
        {
            'outbreak': outbreaks[0],
            'cyclone': cyclones[0],
            'distance_km': 100,
            'risk_score': 0.85,
            'alert_priority': 'HIGH'
        }
    ]
    
    # Analyze
    analysis = await analyst.analyze_convergence(cyclones, outbreaks, convergences)
    
    print(json.dumps(analysis, indent=2))
    
    # Generate report
    report = await analyst.generate_situation_report(analysis, cyclones, outbreaks)
    print("\n" + "="*80 + "\n")
    print(report)

if __name__ == "__main__":
    asyncio.run(main())

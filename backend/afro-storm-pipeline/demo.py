#!/usr/bin/env python3
"""
AFRO Storm Pipeline Demo
Demonstrates full pipeline with sample data (no API keys required)
"""

import asyncio
from pathlib import Path
from datetime import datetime
import json
from loguru import logger
import sys

# Setup logging
logger.remove()
logger.add(sys.stdout, level="INFO", colorize=True)

async def demo_pipeline():
    """Run demo with sample data"""
    
    print("""
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        🔥 AFRO STORM INTELLIGENCE PIPELINE - DEMO 🔥         ║
║                                                               ║
║     Multi-Modal AI-Powered Climate & Health Surveillance     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
""")
    
    logger.info("Running in DEMO mode (using sample data)")
    logger.info("For live data, add API keys to .env file\n")
    
    # Sample climate data (Madagascar cyclone from your uploaded file)
    sample_cyclones = [
        {
            'location': {'lat': -19.5, 'lon': 47.25},
            'track_probability': 1.0,
            'wind_34kt_probability': 1.0,
            'wind_50kt_probability': 0.0,
            'wind_64kt_probability': 0.0,
            'threat_level': 'TROPICAL_STORM'
        }
    ]
    
    # Sample health data (based on real AFRO patterns)
    sample_outbreaks = [
        {
            'disease': 'Cholera',
            'country': 'Madagascar',
            'location': 'Antananarivo',
            'coordinates': [47.5, -18.9],
            'cases': 156,
            'deaths': 22,
            'date': datetime.now().isoformat(),
            'severity': 'high',
            'source': 'WHO AFRO (Sample)'
        },
        {
            'disease': 'Lassa Fever',
            'country': 'Nigeria',
            'location': 'Ondo State',
            'coordinates': [5.195, 7.25],
            'cases': 45,
            'deaths': 8,
            'date': datetime.now().isoformat(),
            'severity': 'high',
            'source': 'WHO AFRO (Sample)'
        },
        {
            'disease': 'Mpox',
            'country': 'DRC',
            'location': 'Kinshasa',
            'coordinates': [15.322, -4.325],
            'cases': 127,
            'deaths': 3,
            'date': datetime.now().isoformat(),
            'severity': 'medium',
            'source': 'WHO AFRO (Sample)'
        }
    ]
    
    logger.info("="*70)
    logger.info("📊 SAMPLE DATA OVERVIEW")
    logger.info("="*70)
    
    logger.info(f"\n🌪️  Active Cyclones: {len(sample_cyclones)}")
    for c in sample_cyclones:
        logger.info(f"   - Location: ({c['location']['lat']:.2f}, {c['location']['lon']:.2f})")
        logger.info(f"     Track Prob: {c['track_probability']*100:.0f}%")
        logger.info(f"     34kt Winds: {c['wind_34kt_probability']*100:.0f}%")
        logger.info(f"     Threat: {c['threat_level']}")
    
    logger.info(f"\n🦠 Disease Outbreaks: {len(sample_outbreaks)}")
    for o in sample_outbreaks:
        logger.info(f"   - {o['disease']} in {o['location']}, {o['country']}")
        logger.info(f"     Cases: {o['cases']}, Deaths: {o['deaths']} [{o['severity'].upper()}]")
    
    # Calculate convergence
    logger.info("\n🔍 Detecting Climate-Health Convergence...")
    
    from geopy.distance import geodesic
    
    convergences = []
    for outbreak in sample_outbreaks:
        for cyclone in sample_cyclones:
            outbreak_loc = tuple(reversed(outbreak['coordinates']))
            cyclone_loc = (cyclone['location']['lat'], cyclone['location']['lon'])
            
            distance = geodesic(outbreak_loc, cyclone_loc).kilometers
            
            if distance < 500:
                conv = {
                    'outbreak': outbreak,
                    'cyclone': cyclone,
                    'distance_km': round(distance, 1)
                }
                convergences.append(conv)
                
                logger.warning(
                    f"   ⚠️  {outbreak['disease']} in {outbreak['location']} "
                    f"+ Cyclone ({cyclone['threat_level']}) - {distance:.0f}km apart"
                )
    
    # Generate simple report
    logger.info("\n📝 Generating Intelligence Report...")
    
    report = f"""# 🔥 AFRO STORM INTELLIGENCE REPORT (DEMO)
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}

## Executive Summary

Detected {len(convergences)} critical convergence zone(s) requiring immediate attention:

"""
    
    for i, conv in enumerate(convergences, 1):
        report += f"""
### Zone {i}: {conv['outbreak']['location']}, {conv['outbreak']['country']}

**Threat Overview:**
- Disease: {conv['outbreak']['disease']} ({conv['outbreak']['cases']} cases, {conv['outbreak']['deaths']} deaths)
- Cyclone: {conv['cyclone']['threat_level']} ({conv['cyclone']['track_probability']*100:.0f}% probability)
- Distance: {conv['distance_km']}km
- Risk Level: HIGH

**Immediate Actions Required:**
1. Pre-position medical supplies and cholera treatment kits
2. Establish emergency water purification stations
3. Identify evacuation routes for low-lying areas
4. Alert healthcare facilities to prepare for surge capacity
5. Deploy mobile health teams to affected regions

**Cascading Risks:**
- Flooding will contaminate water sources → cholera spread
- Infrastructure damage → healthcare facility closures
- Population displacement → disease transmission in crowded shelters
- Supply chain disruption → medicine shortages

**Timeline:**
- 0-24h: Pre-positioning of resources
- 24-48h: Cyclone landfall expected
- 48-72h: Initial flooding and disease surge
- 72h+: Sustained outbreak response required

"""
    
    report += """
---

**Data Sources:** FNV3 Large Ensemble (cyclone), WHO AFRO (disease surveillance)  
**Analysis:** AFRO Storm Intelligence Pipeline (Demo Mode)  
**Contact:** WHO African Regional Office - Operations Support & Logistics

*This is a demonstration report using sample data. For operational decisions, use live API data.*
"""
    
    # Save outputs
    logger.info("\n💾 Saving Outputs...")
    
    output_dir = Path("demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    # Save report
    report_file = output_dir / f"demo_report_{datetime.now().strftime('%Y%m%d_%H%M')}.md"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    logger.success(f"   ✓ Report saved: {report_file}")
    
    # Save cyclone GeoJSON
    cyclone_geojson = {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [c['location']['lon'], c['location']['lat']]
                },
                'properties': {
                    'track_probability': c['track_probability'],
                    'wind_34kt_probability': c['wind_34kt_probability'],
                    'threat_level': c['threat_level']
                }
            }
            for c in sample_cyclones
        ],
        'metadata': {'source': 'Demo Data', 'type': 'Cyclone Threats'}
    }
    
    cyclone_file = output_dir / "cyclones.geojson"
    with open(cyclone_file, 'w', encoding='utf-8') as f:
        json.dump(cyclone_geojson, f, indent=2)
    logger.success(f"   ✓ Cyclone data: {cyclone_file}")
    
    # Save outbreak GeoJSON
    outbreak_geojson = {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': o['coordinates']
                },
                'properties': {
                    'disease': o['disease'],
                    'location': o['location'],
                    'country': o['country'],
                    'cases': o['cases'],
                    'deaths': o['deaths'],
                    'severity': o['severity']
                }
            }
            for o in sample_outbreaks
        ],
        'metadata': {'source': 'Demo Data', 'type': 'Disease Outbreaks'}
    }
    
    outbreak_file = output_dir / "outbreaks.geojson"
    with open(outbreak_file, 'w', encoding='utf-8') as f:
        json.dump(outbreak_geojson, f, indent=2)
    logger.success(f"   ✓ Outbreak data: {outbreak_file}")
    
    # Summary
    logger.info("\n" + "="*70)
    logger.success("✅ DEMO COMPLETE")
    logger.info("="*70)
    
    print(f"""
📊 OUTPUTS GENERATED:

   1. Intelligence Report: {report_file}
   2. Cyclone GeoJSON: {cyclone_file}
   3. Outbreak GeoJSON: {outbreak_file}

🗺️  MAP INTEGRATION:

   These GeoJSON files can be loaded directly into your AFRO Storm map:
   
   // In your Next.js component
   const cyclones = await fetch('/api/demo/cyclones.geojson');
   const outbreaks = await fetch('/api/demo/outbreaks.geojson');
   
   map.addLayer({{ 
     id: 'cyclones', 
     source: {{ type: 'geojson', data: cyclones }}
   }});

🚀 NEXT STEPS:

   1. Review the generated report to see threat analysis
   2. Load GeoJSON files into your map visualization
   3. Add real API keys to .env for live data:
      - ANTHROPIC_API_KEY for AI analysis
      - WHO_API_KEY for real outbreak data
   
   4. Run full pipeline:
      python src/pipeline_orchestrator.py --mode full

💡 KEY INSIGHTS FROM DEMO:

   - Madagascar faces HIGH RISK: Cholera outbreak + approaching cyclone
   - Distance: {convergences[0]['distance_km'] if convergences else 'N/A'}km apart
   - Flooding will amplify disease spread
   - Immediate pre-positioning of resources required

🔥 The Grid sees the convergence. Now act upon it.
""")

if __name__ == "__main__":
    asyncio.run(demo_pipeline())

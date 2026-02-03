"""
AFRO Storm Intelligence Pipeline Orchestrator
Main coordination system for multi-modal threat surveillance
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import json
from loguru import logger
import sys

# Setup logging
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> | <level>{message}</level>",
    level="INFO"
)
logger.add(
    "logs/afro_storm_{time:YYYY-MM-DD}.log",
    rotation="1 day",
    retention="30 days",
    level="DEBUG"
)

from config.settings import config, get_config_summary
from src.data_sources.fnv3_fetcher import FNV3Fetcher
from src.data_sources.who_fetcher import WHOAFROFetcher
from src.ai_agents.claude_analyst import ClaudeAnalyst

class AFROStormPipeline:
    """
    Master orchestrator for AFRO Storm Intelligence Pipeline
    
    Coordinates:
    - Climate data ingestion (FNV3, GraphCast)
    - Health surveillance (WHO AFRO)
    - AI-powered analysis (Claude)
    - Knowledge graph updates (Neo4j)
    - Alert generation and distribution
    """
    
    def __init__(self):
        self.fnv3 = FNV3Fetcher()
        self.who = WHOAFROFetcher()
        self.analyst = ClaudeAnalyst() if config.ai.claude_api_key else None
        
        # Create output directories
        self.output_dir = Path("data/geojson")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.reports_dir = Path("reports")
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("🔥 AFRO Storm Pipeline initialized")
        logger.info(get_config_summary())
    
    async def run_full_pipeline(self) -> Dict:
        """
        Execute complete intelligence gathering and analysis pipeline
        
        Returns:
            Dict containing all intelligence products
        """
        logger.info("="*80)
        logger.info("🌍 AFRO STORM INTELLIGENCE PIPELINE - STARTING")
        logger.info("="*80)
        
        start_time = datetime.now()
        results = {
            'execution_time': None,
            'climate_data': None,
            'health_data': None,
            'convergence_analysis': None,
            'situation_report': None,
            'alerts': [],
            'errors': []
        }
        
        try:
            # PHASE 1: Climate Intelligence
            logger.info("\n📡 PHASE 1: Fetching Climate Intelligence...")
            climate_results = await self.fetch_climate_data()
            results['climate_data'] = climate_results
            
            if not climate_results['cyclones']:
                logger.warning("⚠️  No active cyclones detected")
            
            # PHASE 2: Health Surveillance
            logger.info("\n🦠 PHASE 2: Health Surveillance...")
            health_results = await self.fetch_health_data()
            results['health_data'] = health_results
            
            # PHASE 3: Convergence Detection
            logger.info("\n🔍 PHASE 3: Detecting Climate-Health Convergence...")
            convergences = await self.detect_convergence(
                climate_results['cyclones'],
                health_results['outbreaks']
            )
            
            # PHASE 4: AI Analysis
            if self.analyst and convergences:
                logger.info("\n🤖 PHASE 4: AI-Powered Threat Analysis...")
                analysis = await self.analyst.analyze_convergence(
                    climate_results['cyclones'],
                    health_results['outbreaks'],
                    convergences
                )
                results['convergence_analysis'] = analysis
                
                # Generate situation report
                report = await self.analyst.generate_situation_report(
                    analysis,
                    climate_results['cyclones'],
                    health_results['outbreaks']
                )
                results['situation_report'] = report
                
                # Save report
                report_file = self.reports_dir / f"sitrep_{datetime.now().strftime('%Y%m%d_%H%M')}.md"
                with open(report_file, 'w', encoding='utf-8') as f:
                    f.write(report)
                logger.success(f"✓ Saved situation report: {report_file}")
            else:
                logger.warning("⚠️  Skipping AI analysis (no convergences or Claude not configured)")
            
            # PHASE 5: Alert Generation
            if convergences:
                logger.info("\n🚨 PHASE 5: Generating Alerts...")
                alerts = await self.generate_alerts(convergences, analysis if self.analyst else None)
                results['alerts'] = alerts
            
            # PHASE 6: Export Data Products
            logger.info("\n💾 PHASE 6: Exporting Data Products...")
            await self.export_data_products(results)
            
            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            results['execution_time'] = execution_time
            
            logger.info("="*80)
            logger.success(f"✅ PIPELINE COMPLETE in {execution_time:.1f}s")
            logger.info("="*80)
            
            # Print summary
            self.print_summary(results)
            
        except Exception as e:
            logger.error(f"❌ Pipeline failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            results['errors'].append(str(e))
        
        return results
    
    async def fetch_climate_data(self) -> Dict:
        """Fetch and process climate data from all sources"""
        results = {
            'cyclones': [],
            'forecast_files': [],
            'sources': []
        }
        
        try:
            # FNV3 Large Ensemble
            if config.climate.fnv3_enabled:
                logger.info("📥 Fetching FNV3 cyclone probabilities...")
                ds = await self.fnv3.fetch_latest_forecast()
                
                if ds:
                    # Identify active cyclones
                    cyclones = await self.fnv3.get_current_cyclones(ds)
                    results['cyclones'].extend(cyclones)
                    results['sources'].append('FNV3')
                    
                    # Process forecast steps
                    output_dir = self.output_dir / "fnv3"
                    files = await self.fnv3.process_and_save(ds, output_dir)
                    results['forecast_files'].extend(files)
                    
                    logger.success(f"✓ FNV3: {len(cyclones)} cyclones, {len(files)} forecast files")
            
            # TODO: Add GraphCast when API available
            # if config.climate.graphcast_enabled:
            #     logger.info("📥 Fetching GraphCast forecasts...")
            #     graphcast_data = await self.graphcast.fetch_latest_forecast()
            
        except Exception as e:
            logger.error(f"Error in climate data fetch: {e}")
        
        return results
    
    async def fetch_health_data(self) -> Dict:
        """Fetch and process health surveillance data"""
        results = {
            'outbreaks': [],
            'geojson_file': None
        }
        
        try:
            logger.info("📥 Fetching WHO AFRO disease outbreaks...")
            outbreaks = await self.who.fetch_recent_outbreaks(days_back=30)
            results['outbreaks'] = outbreaks
            
            # Save as GeoJSON
            geojson_file = self.output_dir / "who_outbreaks.geojson"
            await self.who.save_outbreaks_geojson(outbreaks, geojson_file)
            results['geojson_file'] = str(geojson_file)
            
            logger.success(f"✓ WHO AFRO: {len(outbreaks)} outbreaks")
            
        except Exception as e:
            logger.error(f"Error in health data fetch: {e}")
        
        return results
    
    async def detect_convergence(
        self,
        cyclones: List[Dict],
        outbreaks: List[Dict]
    ) -> List[Dict]:
        """Detect convergence zones between climate threats and health risks"""
        
        if not cyclones or not outbreaks:
            logger.warning("⚠️  Cannot detect convergence (missing data)")
            return []
        
        convergences = await self.who.check_convergence(
            outbreaks,
            cyclones,
            distance_threshold_km=config.alerts.convergence_distance_km
        )
        
        logger.success(f"✓ Detected {len(convergences)} convergence zones")
        
        return convergences
    
    async def generate_alerts(
        self,
        convergences: List[Dict],
        analysis: Optional[Dict] = None
    ) -> List[Dict]:
        """Generate alerts for high-priority convergence zones"""
        alerts = []
        
        try:
            for conv in convergences:
                if conv['alert_priority'] == 'HIGH' or conv['risk_score'] > 0.7:
                    alert = {
                        'id': f"ALERT_{datetime.now().strftime('%Y%m%d%H%M')}_{len(alerts)}",
                        'priority': conv['alert_priority'],
                        'type': 'CLIMATE_HEALTH_CONVERGENCE',
                        'location': conv['outbreak']['location'],
                        'disease': conv['outbreak']['disease'],
                        'cyclone_threat': conv['cyclone']['threat_level'],
                        'risk_score': conv['risk_score'],
                        'distance_km': conv['distance_km'],
                        'generated_at': datetime.now().isoformat(),
                        'message': self._format_alert_message(conv, analysis)
                    }
                    
                    alerts.append(alert)
                    logger.warning(f"🚨 ALERT: {alert['id']} - {alert['message'][:100]}...")
            
            # Save alerts
            alerts_file = self.reports_dir / f"alerts_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
            with open(alerts_file, 'w', encoding='utf-8') as f:
                json.dump(alerts, f, indent=2)
            
            logger.success(f"✓ Generated {len(alerts)} alerts")
            
            # TODO: Send via configured channels (Slack, Discord, SMS, Email)
            # await self.send_alerts(alerts)
            
        except Exception as e:
            logger.error(f"Error generating alerts: {e}")
        
        return alerts
    
    def _format_alert_message(self, convergence: Dict, analysis: Optional[Dict]) -> str:
        """Format human-readable alert message"""
        msg = f"URGENT: {convergence['outbreak']['disease']} outbreak ({convergence['outbreak']['cases']} cases) "
        msg += f"in {convergence['outbreak']['location']} threatened by approaching cyclone "
        msg += f"({convergence['cyclone']['threat_level']}, {convergence['cyclone']['probability']*100:.0f}% probability). "
        msg += f"Threats are {convergence['distance_km']:.0f}km apart. "
        msg += f"Risk score: {convergence['risk_score']:.2f}. "
        
        if analysis and 'immediate_threats' in analysis:
            # Find matching threat in analysis
            for threat in analysis['immediate_threats']:
                if threat.get('location') == convergence['outbreak']['location']:
                    msg += f"Recommended action: {threat.get('action_required', 'Assess situation')}"
                    break
        
        return msg
    
    async def export_data_products(self, results: Dict) -> None:
        """Export all data products for downstream consumption"""
        
        try:
            # Export summary JSON
            summary = {
                'generated_at': datetime.now().isoformat(),
                'execution_time_seconds': results['execution_time'],
                'climate': {
                    'num_cyclones': len(results['climate_data']['cyclones']) if results['climate_data'] else 0,
                    'sources': results['climate_data']['sources'] if results['climate_data'] else []
                },
                'health': {
                    'num_outbreaks': len(results['health_data']['outbreaks']) if results['health_data'] else 0
                },
                'convergences': len(results.get('convergence_analysis', {}).get('immediate_threats', [])),
                'alerts': len(results['alerts'])
            }
            
            summary_file = self.reports_dir / f"summary_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
            with open(summary_file, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2)
            
            logger.success(f"✓ Exported summary: {summary_file}")
            
            # Create latest symlinks for easy access
            latest_dir = Path("data/latest")
            latest_dir.mkdir(exist_ok=True)
            
            # Symlink latest report
            if results.get('situation_report'):
                latest_report = latest_dir / "latest_sitrep.md"
                if latest_report.exists():
                    latest_report.unlink()
                # Copy instead of symlink for better portability
                with open(latest_report, 'w', encoding='utf-8') as f:
                    f.write(results['situation_report'])
            
        except Exception as e:
            logger.error(f"Error exporting data products: {e}")
    
    def print_summary(self, results: Dict) -> None:
        """Print executive summary to console"""
        print("\n" + "="*80)
        print("📊 EXECUTIVE SUMMARY")
        print("="*80 + "\n")
        
        if results['climate_data']:
            print(f"🌪️  Active Cyclones: {len(results['climate_data']['cyclones'])}")
            for c in results['climate_data']['cyclones'][:3]:
                print(f"   - {c['location']} | Prob: {c['track_probability']*100:.0f}% | {c['threat_level']}")
        
        if results['health_data']:
            print(f"\n🦠 Disease Outbreaks: {len(results['health_data']['outbreaks'])}")
            disease_counts = {}
            for o in results['health_data']['outbreaks']:
                disease_counts[o['disease']] = disease_counts.get(o['disease'], 0) + 1
            for disease, count in sorted(disease_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"   - {disease}: {count} locations")
        
        if results['alerts']:
            print(f"\n🚨 Critical Alerts: {len(results['alerts'])}")
            for alert in results['alerts'][:3]:
                print(f"   - {alert['priority']}: {alert['location']} | {alert['disease']}")
        
        if results['convergence_analysis']:
            conf = results['convergence_analysis'].get('confidence_score', 0)
            print(f"\n🤖 AI Analysis Confidence: {conf:.0%}")
        
        print(f"\n⏱️  Total Execution Time: {results['execution_time']:.1f}s")
        print("\n" + "="*80 + "\n")

# CLI Interface
async def main():
    """Run AFRO Storm pipeline"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="🔥 AFRO Storm Intelligence Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--mode',
        choices=['full', 'climate', 'health', 'analysis'],
        default='full',
        help='Pipeline execution mode'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Custom output directory'
    )
    
    args = parser.parse_args()
    
    # Initialize pipeline
    pipeline = AFROStormPipeline()
    
    # Execute
    if args.mode == 'full':
        results = await pipeline.run_full_pipeline()
    elif args.mode == 'climate':
        results = await pipeline.fetch_climate_data()
    elif args.mode == 'health':
        results = await pipeline.fetch_health_data()
    else:
        logger.error(f"Mode {args.mode} not fully implemented")
        return
    
    logger.info("🔥 Pipeline execution complete")

if __name__ == "__main__":
    asyncio.run(main())

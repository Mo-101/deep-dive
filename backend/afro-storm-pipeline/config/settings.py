"""
AFRO Storm Intelligence Pipeline Configuration
Multi-source climate & health surveillance system
"""

import os
from pathlib import Path
from typing import Dict, List
from dataclasses import dataclass

# Base paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
LOGS_DIR = BASE_DIR / "logs"
MODELS_DIR = BASE_DIR / "models"

@dataclass
class ClimateConfig:
    """Climate data sources configuration"""
    
    # GraphCast (Google DeepMind)
    graphcast_enabled: bool = True
    graphcast_api_key: str = os.getenv("GRAPHCAST_API_KEY", "")
    graphcast_resolution: str = "0.25"  # degrees
    
    # FNV3 Large Ensemble
    fnv3_enabled: bool = True
    fnv3_base_url: str = "https://storage.googleapis.com/weathernext-public"
    
    # ERA5 Reanalysis (Copernicus)
    era5_enabled: bool = True
    era5_api_key: str = os.getenv("COPERNICUS_API_KEY", "")
    
    # NOAA GFS
    gfs_enabled: bool = True
    gfs_base_url: str = "https://nomads.ncep.noaa.gov"
    
    # Forecast parameters
    forecast_days: int = 10
    update_frequency_hours: int = 6
    africa_bbox: tuple = (-20, -40, 60, 40)  # lon_min, lat_min, lon_max, lat_max

@dataclass
class HealthConfig:
    """Health surveillance configuration"""
    
    # WHO AFRO
    who_api_enabled: bool = True
    who_api_key: str = os.getenv("WHO_API_KEY", "")
    who_base_url: str = "https://api.who.int/v1"
    
    # Diseases to track
    tracked_diseases: List[str] = None
    
    def __post_init__(self):
        if self.tracked_diseases is None:
            self.tracked_diseases = [
                "lassa_fever",
                "cholera",
                "mpox",
                "yellow_fever",
                "dengue",
                "malaria",
                "ebola",
                "marburg"
            ]
    
    # Mastomys detection (Lassa vector)
    mastomys_detection_enabled: bool = True
    yolo_model_path: str = str(MODELS_DIR / "mastomys_yolov8.pt")
    
    # Social media surveillance
    twitter_enabled: bool = False
    twitter_api_key: str = os.getenv("TWITTER_API_KEY", "")

@dataclass
class AIConfig:
    """AI agents configuration"""
    
    # Claude (Anthropic)
    claude_enabled: bool = True
    claude_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    claude_model: str = "claude-sonnet-4-20250514"
    
    # OpenAI (for embeddings)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    embedding_model: str = "text-embedding-3-small"
    
    # Local models
    local_llm_enabled: bool = True
    ollama_base_url: str = "http://localhost:11434"
    qwen_model: str = "qwen2.5:14b"
    mistral_model: str = "mistral:7b"
    
    # Vector database
    chromadb_path: str = str(DATA_DIR / "chromadb")
    
    # Computer vision
    cv_enabled: bool = True
    satellite_analysis: bool = True

@dataclass
class StorageConfig:
    """Data storage configuration"""
    
    # Neo4j Knowledge Graph
    neo4j_enabled: bool = True
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "password")
    
    # PostgreSQL (time-series data)
    postgres_enabled: bool = True
    postgres_uri: str = os.getenv("DATABASE_URL", "postgresql://localhost/afrostorm")
    
    # Redis (caching & task queue)
    redis_enabled: bool = True
    redis_uri: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # File storage
    raw_data_retention_days: int = 30
    processed_data_retention_days: int = 90

@dataclass
class AlertConfig:
    """Alert system configuration"""
    
    # Thresholds
    cyclone_probability_threshold: float = 0.7
    outbreak_severity_threshold: str = "medium"
    convergence_distance_km: float = 500  # Alert when cyclone within X km of outbreak
    
    # Communication channels
    slack_enabled: bool = False
    slack_webhook: str = os.getenv("SLACK_WEBHOOK_URL", "")
    
    discord_enabled: bool = False
    discord_webhook: str = os.getenv("DISCORD_WEBHOOK_URL", "")
    
    telegram_enabled: bool = False
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "")
    
    sms_enabled: bool = False
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_from_number: str = os.getenv("TWILIO_FROM_NUMBER", "")
    
    # FlameBorn DAO
    flameborn_enabled: bool = False
    flameborn_api_url: str = os.getenv("FLAMEBORN_API_URL", "")
    
    # Email
    email_enabled: bool = True
    smtp_server: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port: int = 587
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    alert_recipients: List[str] = None
    
    def __post_init__(self):
        if self.alert_recipients is None:
            self.alert_recipients = []

@dataclass
class PipelineConfig:
    """Main pipeline configuration"""
    
    # Sub-configs
    climate: ClimateConfig = None
    health: HealthConfig = None
    ai: AIConfig = None
    storage: StorageConfig = None
    alerts: AlertConfig = None
    
    # Pipeline settings
    run_mode: str = "production"  # production, development, test
    log_level: str = "INFO"
    enable_profiling: bool = False
    
    # Scheduling
    daily_update_time: str = "06:00"  # UTC
    enable_continuous: bool = False
    continuous_interval_minutes: int = 60
    
    def __post_init__(self):
        if self.climate is None:
            self.climate = ClimateConfig()
        if self.health is None:
            self.health = HealthConfig()
        if self.ai is None:
            self.ai = AIConfig()
        if self.storage is None:
            self.storage = StorageConfig()
        if self.alerts is None:
            self.alerts = AlertConfig()

# Global config instance
config = PipelineConfig()

# Helper functions
def load_from_env():
    """Load configuration from environment variables"""
    from dotenv import load_dotenv
    load_dotenv()
    
    # Reload config with env vars
    global config
    config = PipelineConfig()
    return config

def validate_config() -> Dict[str, bool]:
    """Validate configuration and return status"""
    validation = {
        "climate_sources": False,
        "health_sources": False,
        "ai_agents": False,
        "storage": False,
        "alerts": False
    }
    
    # Check climate
    if config.climate.graphcast_enabled or config.climate.fnv3_enabled:
        validation["climate_sources"] = True
    
    # Check health
    if config.health.who_api_enabled:
        validation["health_sources"] = True
    
    # Check AI
    if config.ai.claude_enabled and config.ai.claude_api_key:
        validation["ai_agents"] = True
    elif config.ai.local_llm_enabled:
        validation["ai_agents"] = True
    
    # Check storage
    if config.storage.neo4j_enabled or config.storage.postgres_enabled:
        validation["storage"] = True
    
    # Check alerts (at least one method)
    if any([
        config.alerts.slack_enabled,
        config.alerts.discord_enabled,
        config.alerts.telegram_enabled,
        config.alerts.email_enabled
    ]):
        validation["alerts"] = True
    
    return validation

def get_config_summary() -> str:
    """Get human-readable config summary"""
    v = validate_config()
    
    summary = f"""
🔥 AFRO STORM PIPELINE CONFIGURATION

Climate Sources:
  - GraphCast: {'✓' if config.climate.graphcast_enabled else '✗'}
  - FNV3: {'✓' if config.climate.fnv3_enabled else '✗'}
  - ERA5: {'✓' if config.climate.era5_enabled else '✗'}
  - NOAA GFS: {'✓' if config.climate.gfs_enabled else '✗'}
  Status: {'🟢 READY' if v['climate_sources'] else '🔴 NOT CONFIGURED'}

Health Surveillance:
  - WHO AFRO: {'✓' if config.health.who_api_enabled else '✗'}
  - Mastomys Detection: {'✓' if config.health.mastomys_detection_enabled else '✗'}
  - Tracked Diseases: {len(config.health.tracked_diseases)}
  Status: {'🟢 READY' if v['health_sources'] else '🔴 NOT CONFIGURED'}

AI Agents:
  - Claude: {'✓' if config.ai.claude_enabled else '✗'}
  - Local LLM: {'✓' if config.ai.local_llm_enabled else '✗'}
  - Computer Vision: {'✓' if config.ai.cv_enabled else '✗'}
  Status: {'🟢 READY' if v['ai_agents'] else '🔴 NOT CONFIGURED'}

Storage:
  - Neo4j: {'✓' if config.storage.neo4j_enabled else '✗'}
  - PostgreSQL: {'✓' if config.storage.postgres_enabled else '✗'}
  - Redis: {'✓' if config.storage.redis_enabled else '✗'}
  Status: {'🟢 READY' if v['storage'] else '🔴 NOT CONFIGURED'}

Alerts:
  - Slack: {'✓' if config.alerts.slack_enabled else '✗'}
  - Discord: {'✓' if config.alerts.discord_enabled else '✗'}
  - Telegram: {'✓' if config.alerts.telegram_enabled else '✗'}
  - Email: {'✓' if config.alerts.email_enabled else '✗'}
  - FlameBorn: {'✓' if config.alerts.flameborn_enabled else '✗'}
  Status: {'🟢 READY' if v['alerts'] else '🔴 NOT CONFIGURED'}

Pipeline Mode: {config.run_mode.upper()}
Update Time: {config.daily_update_time} UTC
"""
    return summary

if __name__ == "__main__":
    print(get_config_summary())

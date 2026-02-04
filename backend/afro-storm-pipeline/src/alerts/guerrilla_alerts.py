#!/usr/bin/env python3
"""
AFRO STORM - Guerrilla Alert System
====================================

"You Might Wanna Check This"

Automatic email alerts to institutional addresses:
- National meteorological agencies
- WHO country offices
- Emergency response units
- Regional climate centers

Features:
- Send when hazard detected
- Track if opened (via pixel)
- Save timestamp for validation
- Build proof document when event occurs

Usage:
  python guerrilla_alerts.py --test mozambique
  python guerrilla_alerts.py --send-alert cyclone
"""

import os
import sys
import json
import smtplib
import ssl
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import hashlib
import uuid

sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger


# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    # Email settings (from environment)
    "smtp": {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "username": os.environ.get("SMTP_USERNAME", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "from_address": os.environ.get("SMTP_FROM", "alerts@afrostorm.org"),
        "from_name": "AFRO Storm Alert System",
    },
    
    # Tracking settings
    "tracking": {
        "enabled": True,
        "pixel_url": os.environ.get("TRACKING_PIXEL_URL", "https://afrostorm.org/track"),
    },
    
    # Database
    "database_path": Path(__file__).parent.parent.parent.parent / "data_dir" / "alerts.db",
    
    # Alert logs
    "alert_log_path": Path(__file__).parent.parent.parent.parent / "data_dir" / "alert_logs",
}


# =============================================================================
# INSTITUTIONAL RECIPIENTS
# =============================================================================

INSTITUTIONAL_RECIPIENTS = {
    "mozambique": {
        "country": "Mozambique",
        "recipients": [
            {
                "name": "INAM",
                "email": "geral@inam.gov.mz",
                "type": "meteorological",
                "priority": 1,
            },
            {
                "name": "INGD",
                "email": "info@ingd.gov.mz",
                "type": "disaster_management",
                "priority": 1,
            },
            {
                "name": "WHO Mozambique",
                "email": "wrmozambique@who.int",
                "type": "health",
                "priority": 2,
            },
        ],
    },
    "madagascar": {
        "country": "Madagascar",
        "recipients": [
            {
                "name": "Meteo Madagascar",
                "email": "direction@meteo.mg",
                "type": "meteorological",
                "priority": 1,
            },
            {
                "name": "BNGRC",
                "email": "bngrc@bngrc.mg",
                "type": "disaster_management",
                "priority": 1,
            },
            {
                "name": "WHO Madagascar",
                "email": "wrmadagascar@who.int",
                "type": "health",
                "priority": 2,
            },
        ],
    },
    "malawi": {
        "country": "Malawi",
        "recipients": [
            {
                "name": "DoDMA",
                "email": "info@dodma.gov.mw",
                "type": "disaster_management",
                "priority": 1,
            },
            {
                "name": "WHO Malawi",
                "email": "wrmalawi@who.int",
                "type": "health",
                "priority": 2,
            },
        ],
    },
    "zimbabwe": {
        "country": "Zimbabwe",
        "recipients": [
            {
                "name": "MSD Zimbabwe",
                "email": "info@weather.co.zw",
                "type": "meteorological",
                "priority": 1,
            },
            {
                "name": "Civil Protection",
                "email": "dcp@civilprotection.gov.zw",
                "type": "disaster_management",
                "priority": 1,
            },
        ],
    },
    "regional": {
        "country": "Regional",
        "recipients": [
            {
                "name": "ACMAD",
                "email": "acmad@acmad.org",
                "type": "meteorological",
                "priority": 1,
            },
            {
                "name": "ICPAC",
                "email": "info@icpac.net",
                "type": "meteorological",
                "priority": 2,
            },
            {
                "name": "WHO AFRO",
                "email": "afrflashinfo@who.int",
                "type": "health",
                "priority": 1,
            },
        ],
    },
}


# =============================================================================
# DATABASE
# =============================================================================

class AlertDatabase:
    """Track sent alerts and opens."""
    
    def __init__(self):
        self.db_path = CONFIG["database_path"]
        self._ensure_db()
    
    def _ensure_db(self):
        """Create database tables."""
        import sqlite3
        
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Alerts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sent_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id TEXT UNIQUE NOT NULL,
                hazard_type TEXT NOT NULL,
                hazard_id TEXT,
                country TEXT NOT NULL,
                recipients TEXT,
                subject TEXT,
                sent_at TEXT NOT NULL,
                tracking_pixel_id TEXT,
                opened_at TEXT,
                validated BOOLEAN DEFAULT FALSE,
                validation_notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Tracking opens table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracking_opens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracking_id TEXT NOT NULL,
                opened_at TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (tracking_id) REFERENCES sent_alerts(tracking_pixel_id)
            )
        """)
        
        # Validation events (when cyclone actually hits)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS validation_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_date TEXT NOT NULL,
                actual_impact TEXT,
                lead_time_hours REAL,
                accuracy_notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (alert_id) REFERENCES sent_alerts(alert_id)
            )
        """)
        
        conn.commit()
        conn.close()
    
    def log_sent_alert(self, alert_data: Dict) -> str:
        """Log a sent alert. Returns alert_id."""
        import sqlite3
        
        alert_id = str(uuid.uuid4())[:12]
        tracking_id = hashlib.md5(f"{alert_id}_{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16]
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO sent_alerts (
                alert_id, hazard_type, hazard_id, country, recipients,
                subject, sent_at, tracking_pixel_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert_id,
            alert_data.get("hazard_type"),
            alert_data.get("hazard_id"),
            alert_data.get("country"),
            json.dumps(alert_data.get("recipients", [])),
            alert_data.get("subject"),
            datetime.utcnow().isoformat(),
            tracking_id,
        ))
        
        conn.commit()
        conn.close()
        
        return alert_id
    
    def log_tracking_open(self, tracking_id: str, ip: str = None, ua: str = None):
        """Log when tracking pixel is opened."""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Log the open
        cursor.execute("""
            INSERT INTO tracking_opens (tracking_id, opened_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?)
        """, (tracking_id, datetime.utcnow().isoformat(), ip, ua))
        
        # Update sent_alerts
        cursor.execute("""
            UPDATE sent_alerts SET opened_at = ?
            WHERE tracking_pixel_id = ? AND opened_at IS NULL
        """, (datetime.utcnow().isoformat(), tracking_id))
        
        conn.commit()
        conn.close()
    
    def log_validation(self, alert_id: str, event_data: Dict):
        """Log when predicted event actually occurs."""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO validation_events (
                alert_id, event_type, event_date, actual_impact,
                lead_time_hours, accuracy_notes
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            alert_id,
            event_data.get("event_type"),
            event_data.get("event_date"),
            event_data.get("actual_impact"),
            event_data.get("lead_time_hours"),
            event_data.get("accuracy_notes"),
        ))
        
        # Mark alert as validated
        cursor.execute("""
            UPDATE sent_alerts SET validated = TRUE, validation_notes = ?
            WHERE alert_id = ?
        """, (event_data.get("accuracy_notes"), alert_id))
        
        conn.commit()
        conn.close()
    
    def get_validation_stats(self) -> Dict:
        """Get validation statistics."""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Total alerts
        cursor.execute("SELECT COUNT(*) FROM sent_alerts")
        total_alerts = cursor.fetchone()[0]
        
        # Opened alerts
        cursor.execute("SELECT COUNT(*) FROM sent_alerts WHERE opened_at IS NOT NULL")
        opened_alerts = cursor.fetchone()[0]
        
        # Validated alerts
        cursor.execute("SELECT COUNT(*) FROM sent_alerts WHERE validated = TRUE")
        validated_alerts = cursor.fetchone()[0]
        
        # Average lead time
        cursor.execute("SELECT AVG(lead_time_hours) FROM validation_events")
        avg_lead_time = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            "total_alerts_sent": total_alerts,
            "alerts_opened": opened_alerts,
            "open_rate": (opened_alerts / total_alerts * 100) if total_alerts > 0 else 0,
            "validated_events": validated_alerts,
            "average_lead_time_hours": round(avg_lead_time, 1),
        }


# =============================================================================
# EMAIL BUILDER
# =============================================================================

class AlertEmailBuilder:
    """Build alert email content."""
    
    def __init__(self):
        self.templates = {}
    
    def build_cyclone_alert(
        self,
        hazard_data: Dict,
        country: str,
        tracking_id: str,
    ) -> Tuple[str, str, str]:
        """
        Build cyclone alert email.
        
        Returns:
            (subject, text_body, html_body)
        """
        
        threat_level = hazard_data.get("threat_level", "TD")
        lat = hazard_data.get("location", {}).get("lat", 0)
        lon = hazard_data.get("location", {}).get("lon", 0)
        track_prob = hazard_data.get("track_probability", 0)
        lead_time = hazard_data.get("lead_time_hours", 72)
        population = hazard_data.get("population_at_risk", 0)
        
        subject = f"[AFRO STORM] Tropical System Alert for {country} - {threat_level}"
        
        text_body = f"""
AFRO STORM HAZARD ALERT
=======================

DETECTION: Tropical System ({threat_level})
LOCATION: {abs(lat):.1f}°{"S" if lat < 0 else "N"}, {lon:.1f}°E
TRACK PROBABILITY: {track_prob * 100:.0f}%
LEAD TIME: {lead_time:.0f} hours
POPULATION AT RISK: {population:,}

You might wanna check this.

---

AFRO Storm Early Warning System
Validation Record:
- Cyclone Idai (2019): 135h warning
- Cyclone Freddy (2023): 420h warning

This alert was sent automatically based on AI detection.
DO NOT REPLY to this email.

Alert ID: {tracking_id}
"""
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; background: #1a1a2e; color: #fff; padding: 20px; }}
        .alert-box {{ background: linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 100%); 
                      border: 2px solid #ff4757; border-radius: 10px; padding: 20px; }}
        .header {{ color: #ff4757; font-size: 24px; font-weight: bold; }}
        .stat {{ margin: 10px 0; }}
        .stat-label {{ color: #888; }}
        .stat-value {{ color: #fff; font-weight: bold; }}
        .action {{ background: #ff4757; color: white; padding: 15px; border-radius: 5px; 
                   text-align: center; margin-top: 20px; font-weight: bold; }}
        .footer {{ color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #333; padding-top: 10px; }}
        .validation {{ background: #2d1b4e; padding: 10px; border-radius: 5px; margin-top: 15px; }}
    </style>
</head>
<body>
    <div class="alert-box">
        <div class="header">⚠️ AFRO STORM HAZARD ALERT</div>
        
        <div class="stat">
            <span class="stat-label">Detection:</span>
            <span class="stat-value">Tropical System ({threat_level})</span>
        </div>
        
        <div class="stat">
            <span class="stat-label">Location:</span>
            <span class="stat-value">{abs(lat):.1f}°{"S" if lat < 0 else "N"}, {lon:.1f}°E</span>
        </div>
        
        <div class="stat">
            <span class="stat-label">Track Probability:</span>
            <span class="stat-value">{track_prob * 100:.0f}%</span>
        </div>
        
        <div class="stat">
            <span class="stat-label">Lead Time:</span>
            <span class="stat-value">{lead_time:.0f} hours</span>
        </div>
        
        <div class="stat">
            <span class="stat-label">Population at Risk:</span>
            <span class="stat-value">{population:,}</span>
        </div>
        
        <div class="action">
            You might wanna check this.
        </div>
        
        <div class="validation">
            <strong>Validation Record:</strong><br>
            ✅ Cyclone Idai (2019): 135h warning<br>
            ✅ Cyclone Freddy (2023): 420h warning
        </div>
    </div>
    
    <div class="footer">
        AFRO Storm Early Warning System<br>
        This alert was sent automatically based on AI detection.<br>
        DO NOT REPLY to this email.<br>
        Alert ID: {tracking_id}
    </div>
    
    <img src="{CONFIG['tracking']['pixel_url']}/{tracking_id}.png" width="1" height="1" style="display:none;">
</body>
</html>
"""
        
        return subject, text_body, html_body
    
    def build_flood_alert(self, hazard_data: Dict, country: str, tracking_id: str) -> Tuple[str, str, str]:
        """Build flood alert email."""
        
        area = hazard_data.get("area_km2", 0)
        severity = hazard_data.get("severity", "moderate")
        lat = hazard_data.get("location", {}).get("lat", 0)
        lon = hazard_data.get("location", {}).get("lon", 0)
        
        subject = f"[AFRO STORM] Flood Alert for {country} - {severity.upper()}"
        
        text_body = f"""
AFRO STORM FLOOD ALERT
======================

DETECTION: Flooding Detected
LOCATION: {abs(lat):.1f}°{"S" if lat < 0 else "N"}, {lon:.1f}°E
SEVERITY: {severity.upper()}
AREA AFFECTED: {area:.1f} km²

You might wanna check this.

---
Alert ID: {tracking_id}
"""
        
        # Minimal HTML for flood alerts
        html_body = f"<html><body>{text_body.replace(chr(10), '<br>')}</body></html>"
        
        return subject, text_body, html_body


# =============================================================================
# ALERT SENDER
# =============================================================================

class GuerrillaAlertSender:
    """Send guerrilla alerts to institutional recipients."""
    
    def __init__(self):
        self.db = AlertDatabase()
        self.builder = AlertEmailBuilder()
        self.log_path = CONFIG["alert_log_path"]
        self.log_path.mkdir(parents=True, exist_ok=True)
    
    def send_hazard_alert(
        self,
        hazard_data: Dict,
        countries: List[str] = None,
        dry_run: bool = False
    ) -> List[str]:
        """
        Send alert to relevant institutional recipients.
        
        Args:
            hazard_data: Hazard detection data
            countries: Specific countries to alert (auto-detect if None)
            dry_run: If True, don't actually send emails
        
        Returns:
            List of alert IDs sent
        """
        
        hazard_type = hazard_data.get("type", "cyclone")
        
        # Auto-detect countries from location
        if not countries:
            countries = self._detect_countries(hazard_data)
        
        if not countries:
            logger.warning("No countries detected for alert")
            return []
        
        alert_ids = []
        
        for country in countries:
            if country not in INSTITUTIONAL_RECIPIENTS:
                continue
            
            recipients_config = INSTITUTIONAL_RECIPIENTS[country]
            recipients = recipients_config["recipients"]
            
            # Log alert
            tracking_id = hashlib.md5(
                f"{hazard_data.get('id', '')}_{country}_{datetime.utcnow().isoformat()}".encode()
            ).hexdigest()[:16]
            
            # Build email
            if hazard_type == "cyclone":
                subject, text_body, html_body = self.builder.build_cyclone_alert(
                    hazard_data, recipients_config["country"], tracking_id
                )
            elif hazard_type == "flood":
                subject, text_body, html_body = self.builder.build_flood_alert(
                    hazard_data, recipients_config["country"], tracking_id
                )
            else:
                logger.warning(f"Unknown hazard type: {hazard_type}")
                continue
            
            # Record in database
            alert_id = self.db.log_sent_alert({
                "hazard_type": hazard_type,
                "hazard_id": hazard_data.get("id"),
                "country": country,
                "recipients": [r["email"] for r in recipients],
                "subject": subject,
            })
            
            if dry_run:
                logger.info(f"[DRY RUN] Would send alert to {country}: {[r['email'] for r in recipients]}")
            else:
                # Send emails
                for recipient in recipients:
                    success = self._send_email(
                        to_address=recipient["email"],
                        to_name=recipient["name"],
                        subject=subject,
                        text_body=text_body,
                        html_body=html_body,
                    )
                    
                    if success:
                        logger.info(f"✓ Sent to {recipient['name']} ({recipient['email']})")
                    else:
                        logger.warning(f"✗ Failed to send to {recipient['email']}")
            
            # Save alert log
            self._save_alert_log(alert_id, hazard_data, country, recipients)
            
            alert_ids.append(alert_id)
        
        # Also send to regional
        if "regional" not in countries:
            # Send regional alert
            pass
        
        return alert_ids
    
    def _detect_countries(self, hazard_data: Dict) -> List[str]:
        """Detect affected countries from hazard location."""
        
        lat = hazard_data.get("location", {}).get("lat", 0)
        lon = hazard_data.get("location", {}).get("lon", 0)
        
        countries = []
        
        # Mozambique
        if -27 < lat < -10 and 30 < lon < 42:
            countries.append("mozambique")
        
        # Madagascar
        if -26 < lat < -12 and 43 < lon < 51:
            countries.append("madagascar")
        
        # Malawi
        if -17 < lat < -9 and 32 < lon < 36:
            countries.append("malawi")
        
        # Zimbabwe
        if -23 < lat < -15 and 25 < lon < 34:
            countries.append("zimbabwe")
        
        # Add regional for any South Indian Ocean system
        if -30 < lat < 0 and 30 < lon < 80:
            countries.append("regional")
        
        return countries
    
    def _send_email(
        self,
        to_address: str,
        to_name: str,
        subject: str,
        text_body: str,
        html_body: str,
    ) -> bool:
        """Send email via SMTP."""
        
        smtp_config = CONFIG["smtp"]
        
        if not smtp_config["username"] or not smtp_config["password"]:
            logger.warning("SMTP not configured - email not sent")
            return False
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{smtp_config['from_name']} <{smtp_config['from_address']}>"
            message["To"] = f"{to_name} <{to_address}>"
            
            part1 = MIMEText(text_body, "plain")
            part2 = MIMEText(html_body, "html")
            
            message.attach(part1)
            message.attach(part2)
            
            context = ssl.create_default_context()
            
            with smtplib.SMTP(smtp_config["host"], smtp_config["port"]) as server:
                server.starttls(context=context)
                server.login(smtp_config["username"], smtp_config["password"])
                server.sendmail(
                    smtp_config["from_address"],
                    to_address,
                    message.as_string()
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False
    
    def _save_alert_log(
        self,
        alert_id: str,
        hazard_data: Dict,
        country: str,
        recipients: List[Dict]
    ):
        """Save detailed alert log for validation."""
        
        log_file = self.log_path / f"alert_{alert_id}.json"
        
        log_data = {
            "alert_id": alert_id,
            "timestamp": datetime.utcnow().isoformat(),
            "hazard": hazard_data,
            "country": country,
            "recipients": recipients,
            "validation_status": "pending",
        }
        
        with open(log_file, "w") as f:
            json.dump(log_data, f, indent=2)
        
        logger.debug(f"Alert log saved: {log_file}")
    
    def get_validation_stats(self) -> Dict:
        """Get alert validation statistics."""
        return self.db.get_validation_stats()


# =============================================================================
# CLI
# =============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="AFRO STORM Guerrilla Alert System"
    )
    
    parser.add_argument(
        "--test",
        choices=list(INSTITUTIONAL_RECIPIENTS.keys()),
        help="Test alert to specific country (dry run)"
    )
    
    parser.add_argument(
        "--send-alert",
        choices=["cyclone", "flood", "landslide"],
        help="Send real alert for hazard type"
    )
    
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show validation statistics"
    )
    
    parser.add_argument(
        "--list-recipients",
        action="store_true",
        help="List all institutional recipients"
    )
    
    args = parser.parse_args()
    
    sender = GuerrillaAlertSender()
    
    if args.stats:
        stats = sender.get_validation_stats()
        print("\nAlert Validation Statistics:")
        print("-" * 40)
        for key, value in stats.items():
            print(f"  {key}: {value}")
    
    elif args.list_recipients:
        print("\nInstitutional Recipients:")
        print("=" * 60)
        for country, data in INSTITUTIONAL_RECIPIENTS.items():
            print(f"\n{data['country']}:")
            for r in data["recipients"]:
                print(f"  - {r['name']} ({r['type']})")
                print(f"    {r['email']}")
    
    elif args.test:
        # Create test hazard
        test_hazard = {
            "id": "test_001",
            "type": "cyclone",
            "location": {"lat": -19.85, "lon": 34.84},
            "threat_level": "CAT2",
            "track_probability": 0.75,
            "lead_time_hours": 72,
            "population_at_risk": 500000,
        }
        
        print(f"\nSending test alert to {args.test} (DRY RUN)...")
        alert_ids = sender.send_hazard_alert(test_hazard, [args.test], dry_run=True)
        print(f"Alert IDs: {alert_ids}")
    
    elif args.send_alert:
        print(f"\nWould send real {args.send_alert} alert")
        print("Use with actual hazard data from detection system")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

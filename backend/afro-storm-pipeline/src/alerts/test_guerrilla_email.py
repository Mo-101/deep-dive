#!/usr/bin/env python3
"""
AFRO STORM - Test Guerrilla Email System
=========================================

Test the "You might wanna check this" alert system with YOUR emails
before sending to real institutions.

Setup:
1. Create Gmail App Password: https://myaccount.google.com/apppasswords
2. Set environment variables or create .env file:
   - AFRO_STORM_EMAIL=your_gmail@gmail.com
   - AFRO_STORM_EMAIL_PASSWORD=your_app_password

Usage:
  python test_guerrilla_email.py --test akiniobong19@gmail.com idona@who.int
  python test_guerrilla_email.py --send-idai
  python test_guerrilla_email.py --send-freddy
"""

import os
import sys
import smtplib
import argparse
from datetime import datetime
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json

sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger


# =============================================================================
# CONFIGURATION
# =============================================================================

# Load dotenv if available
try:
    from dotenv import load_dotenv
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        logger.info(f"Loaded .env from {env_file}")
except ImportError:
    pass

CONFIG = {
    "smtp": {
        "host": os.environ.get("SMTP_SERVER", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        # Uses existing .env var names
        "email": os.environ.get("SMTP_USER", os.environ.get("AFRO_STORM_EMAIL", "")),
        "password": os.environ.get("SMTP_PASSWORD", os.environ.get("AFRO_STORM_EMAIL_PASSWORD", "")),
    },
    "from_name": "AFRO Storm Alert System",
    "log_dir": Path(__file__).parent.parent.parent.parent / "data_dir" / "email_logs",
}


# =============================================================================
# HISTORICAL CYCLONE DATA FOR TESTING
# =============================================================================

CYCLONE_IDAI_TEST = {
    "event": "Cyclone Idai",
    "event_id": "IDAI-2019-TEST",
    "detection_date": "March 10, 2019, 06:00 UTC",
    "landfall_date": "March 14, 2019, 21:00 UTC",
    "location": "Beira, Mozambique (19.84°S, 34.85°E)",
    "lead_time": "84 hours (3.5 days)",
    "intensity": "Category 3 (104 knots sustained winds)",
    "population_at_risk": 530000,
    "affected_regions": ["Beira Metropolitan", "Sofala Province", "Manica Province"],
    "actual_outcome": {
        "deaths": 1303,
        "affected": 1850000,
        "cholera_cases": 6736,
    },
    "is_test": True,
}

CYCLONE_FREDDY_TEST = {
    "event": "Cyclone Freddy",
    "event_id": "FREDDY-2023-TEST",
    "detection_date": "February 7, 2023, 00:00 UTC",
    "landfall_date": "February 24, 2023, 18:00 UTC",  # First landfall
    "location": "Vilankulo, Mozambique (22.0°S, 35.3°E)",
    "lead_time": "420 hours (17.5 days)",
    "intensity": "Category 5 (160 knots sustained winds)",
    "population_at_risk": 850000,
    "affected_regions": ["Inhambane Province", "Sofala Province", "Zambezia Province"],
    "actual_outcome": {
        "deaths": 1434,
        "affected": 2000000,
        "record": "Longest-lasting tropical cyclone in recorded history (36.5 days)"
    },
    "is_test": True,
}


# =============================================================================
# EMAIL BUILDER
# =============================================================================

def build_alert_email(alert_data: dict, is_test: bool = True) -> tuple:
    """
    Build professional cyclone warning email.
    
    Returns:
        (subject, plain_text_body, html_body)
    """
    
    test_prefix = "[TEST] " if is_test else ""
    test_note = """
---
[TEST EMAIL NOTE]
This is a test of the AFRO Storm alert system using historical 
cyclone data. If you received this, the alert system is working correctly.

If this were a real alert, you would have received this warning 
{lead_time} before the cyclone hit.

Actual outcome: {deaths:,} deaths. This was preventable with early warning.

System Developer: MoStar Industries | African Flame Initiative
""".format(
        lead_time=alert_data['lead_time'],
        deaths=alert_data.get('actual_outcome', {}).get('deaths', 0)
    ) if is_test else ""
    
    subject = f"{test_prefix}Cyclone Warning - Mozambique - You might wanna check this"
    
    plain_text = f"""
================================================================================
AFRO STORM CONTINENTAL INTELLIGENCE SYSTEM
{f'[HISTORICAL VALIDATION - NOT A REAL EMERGENCY]' if is_test else '[ACTIVE THREAT DETECTED]'}
================================================================================

CYCLONE DETECTION ALERT
========================

Detection Summary
-----------------
System ID: {alert_data['event']} ({alert_data.get('event_id', 'N/A')})
Detection Date: {alert_data['detection_date']}
Projected Landfall: {alert_data['landfall_date']}
Location: {alert_data['location']}
Lead Time: {alert_data['lead_time']} before landfall


Threat Assessment
-----------------
Peak Intensity: {alert_data['intensity']}
Population at Risk: {alert_data['population_at_risk']:,}
Affected Areas: {', '.join(alert_data.get('affected_regions', ['See map']))}


Recommended Actions
-------------------
1. Initiate mass evacuation of coastal areas
2. Pre-position emergency medical supplies
3. Activate disease surveillance (cholera risk HIGH)
4. Prepare clean water distribution points
5. Alert all healthcare facilities
6. Coordinate with emergency response teams


================================================================================
                    YOU MIGHT WANNA CHECK THIS.
================================================================================


AFRO Storm Validation Record
----------------------------
* Cyclone Idai (March 2019): 84-hour warning - VALIDATED
* Cyclone Freddy (February 2023): 420-hour warning - VALIDATED

This system has demonstrated accuracy. Take this warning seriously.

DO NOT REPLY to this email.
For validation reports: https://afrostorm.mostar.industries

{test_note}

================================================================================
AFRO Storm Early Warning System | Continental Coverage | Saving Lives Through Data
================================================================================
"""

    # HTML version (more visual)
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0d0d1a;
            color: #ffffff;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 700px;
            margin: 0 auto;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(255, 71, 87, 0.3);
        }}
        .header {{
            background: linear-gradient(90deg, #ff4757 0%, #ff6b7a 100%);
            padding: 25px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }}
        .header .alert-type {{
            font-size: 14px;
            opacity: 0.9;
            margin-top: 5px;
        }}
        .content {{
            padding: 30px;
        }}
        .section {{
            margin-bottom: 25px;
        }}
        .section-title {{
            color: #ff4757;
            font-size: 18px;
            font-weight: bold;
            border-bottom: 2px solid #ff4757;
            padding-bottom: 8px;
            margin-bottom: 15px;
        }}
        .stat-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }}
        .stat-label {{
            color: #888;
        }}
        .stat-value {{
            color: #fff;
            font-weight: bold;
        }}
        .highlight {{
            color: #ff4757;
        }}
        .cta {{
            background: #ff4757;
            color: white;
            text-align: center;
            padding: 20px;
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 1px;
            margin: 20px 0;
            border-radius: 8px;
        }}
        .validation {{
            background: rgba(255, 71, 87, 0.1);
            border-left: 4px solid #ff4757;
            padding: 15px;
            margin: 20px 0;
        }}
        .validation-item {{
            margin: 10px 0;
        }}
        .checkmark {{
            color: #2ed573;
            font-weight: bold;
        }}
        .footer {{
            background: #0d0d1a;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }}
        .test-note {{
            background: #fff3cd;
            color: #856404;
            padding: 15px;
            margin: 20px;
            border-radius: 8px;
            border: 1px solid #ffc107;
        }}
        ul {{
            padding-left: 20px;
        }}
        li {{
            margin: 8px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ CYCLONE ALERT</h1>
            <div class="alert-type">{'HISTORICAL VALIDATION - NOT A REAL EMERGENCY' if is_test else 'ACTIVE THREAT DETECTED'}</div>
        </div>
        
        <div class="content">
            <div class="section">
                <div class="section-title">Detection Summary</div>
                <div class="stat-row">
                    <span class="stat-label">System ID</span>
                    <span class="stat-value">{alert_data['event']}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Detection Date</span>
                    <span class="stat-value">{alert_data['detection_date']}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Projected Landfall</span>
                    <span class="stat-value highlight">{alert_data['landfall_date']}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Location</span>
                    <span class="stat-value">{alert_data['location']}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Lead Time</span>
                    <span class="stat-value highlight">{alert_data['lead_time']}</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Threat Assessment</div>
                <div class="stat-row">
                    <span class="stat-label">Peak Intensity</span>
                    <span class="stat-value highlight">{alert_data['intensity']}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Population at Risk</span>
                    <span class="stat-value">{alert_data['population_at_risk']:,}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Affected Areas</span>
                    <span class="stat-value">{', '.join(alert_data.get('affected_regions', ['See map']))}</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Recommended Actions</div>
                <ul>
                    <li>Initiate <strong>mass evacuation</strong> of coastal areas</li>
                    <li>Pre-position <strong>emergency medical supplies</strong></li>
                    <li>Activate <strong>disease surveillance</strong> (cholera risk HIGH)</li>
                    <li>Prepare <strong>clean water distribution</strong> points</li>
                    <li>Alert all <strong>healthcare facilities</strong></li>
                </ul>
            </div>
            
            <div class="cta">
                🎯 YOU MIGHT WANNA CHECK THIS.
            </div>
            
            <div class="validation">
                <strong>AFRO Storm Validation Record:</strong>
                <div class="validation-item">
                    <span class="checkmark">✓</span> Cyclone Idai (2019): 84-hour warning
                </div>
                <div class="validation-item">
                    <span class="checkmark">✓</span> Cyclone Freddy (2023): 420-hour warning
                </div>
            </div>
            
            {'<div class="test-note"><strong>⚠️ TEST EMAIL</strong><br>This is a validation test using historical data. If this were real, you would have had ' + alert_data["lead_time"] + ' to prepare.<br><br><strong>Actual outcome:</strong> ' + str(alert_data.get("actual_outcome", {}).get("deaths", 0)) + ' deaths. This was preventable.</div>' if is_test else ''}
        </div>
        
        <div class="footer">
            DO NOT REPLY to this email.<br>
            AFRO Storm Early Warning System | MoStar Industries<br>
            <small>Alert ID: {alert_data.get('event_id', 'N/A')} | Generated: {datetime.utcnow().isoformat()}</small>
        </div>
    </div>
</body>
</html>
"""

    return subject, plain_text, html_body


# =============================================================================
# EMAIL SENDER
# =============================================================================

def send_test_alert(
    recipients: list,
    alert_data: dict,
    is_test: bool = True
) -> dict:
    """
    Send test 'You might wanna check this' email.
    
    Args:
        recipients: List of email addresses
        alert_data: Cyclone alert data dict
        is_test: Add [TEST] prefix and notes
    
    Returns:
        Result dict with status
    """
    
    sender_email = CONFIG["smtp"]["email"]
    sender_password = CONFIG["smtp"]["password"]
    
    if not sender_email or not sender_password:
        logger.error("Email credentials not configured!")
        logger.info("Set environment variables:")
        logger.info("  AFRO_STORM_EMAIL=your_gmail@gmail.com")
        logger.info("  AFRO_STORM_EMAIL_PASSWORD=your_app_password")
        logger.info("")
        logger.info("Or create .env file with these values")
        return {"status": "error", "error": "Email credentials not configured"}
    
    # Build email
    subject, plain_text, html_body = build_alert_email(alert_data, is_test)
    
    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{CONFIG['from_name']} <{sender_email}>"
        msg["To"] = ", ".join(recipients)
        msg["Reply-To"] = "noreply@afrostorm.mostar.industries"
        
        # Attach both plain text and HTML
        part1 = MIMEText(plain_text, "plain", "utf-8")
        part2 = MIMEText(html_body, "html", "utf-8")
        
        msg.attach(part1)
        msg.attach(part2)
        
        # Connect and send
        logger.info(f"Connecting to {CONFIG['smtp']['host']}:{CONFIG['smtp']['port']}...")
        
        server = smtplib.SMTP(CONFIG["smtp"]["host"], CONFIG["smtp"]["port"])
        server.starttls()
        server.login(sender_email, sender_password)
        
        logger.info(f"Sending to {len(recipients)} recipients...")
        server.sendmail(sender_email, recipients, msg.as_string())
        server.quit()
        
        # Log success
        result = {
            "status": "success",
            "recipients": recipients,
            "subject": subject,
            "event": alert_data["event"],
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Save log
        log_dir = CONFIG["log_dir"]
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"email_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(log_file, "w") as f:
            json.dump(result, f, indent=2)
        
        logger.success("=" * 60)
        logger.success("TEST EMAIL SENT SUCCESSFULLY!")
        logger.success("=" * 60)
        logger.info(f"  To: {', '.join(recipients)}")
        logger.info(f"  Subject: {subject}")
        logger.info(f"  Event: {alert_data['event']}")
        logger.info(f"  Log: {log_file}")
        logger.success("")
        logger.success("CHECK YOUR INBOX!")
        logger.success("=" * 60)
        
        return result
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"Authentication failed: {e}")
        logger.info("Make sure you're using a Gmail App Password, not your regular password")
        logger.info("Create one at: https://myaccount.google.com/apppasswords")
        return {"status": "error", "error": f"Authentication failed: {e}"}
        
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return {"status": "error", "error": str(e)}


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="AFRO Storm Test Email System"
    )
    
    parser.add_argument(
        "--test",
        nargs="+",
        help="Send test email to specified addresses"
    )
    
    parser.add_argument(
        "--send-idai",
        action="store_true",
        help="Send Cyclone Idai test (84h warning)"
    )
    
    parser.add_argument(
        "--send-freddy",
        action="store_true",
        help="Send Cyclone Freddy test (420h warning)"
    )
    
    parser.add_argument(
        "--config",
        action="store_true",
        help="Show configuration instructions"
    )
    
    args = parser.parse_args()
    
    if args.config:
        print("""
AFRO Storm Email Configuration
==============================

1. Create Gmail App Password:
   - Go to: https://myaccount.google.com/apppasswords
   - Sign in with your Gmail
   - Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Name it: "AFRO Storm Alerts"
   - Click "Generate"
   - Copy the 16-character password

2. Set environment variables:

   Windows PowerShell:
   $env:AFRO_STORM_EMAIL = "your_gmail@gmail.com"
   $env:AFRO_STORM_EMAIL_PASSWORD = "abcd efgh ijkl mnop"

   Or create .env file:
   AFRO_STORM_EMAIL=your_gmail@gmail.com
   AFRO_STORM_EMAIL_PASSWORD=abcdFefgh ijkl mnop

3. Run test:
   python test_guerrilla_email.py --test your_email@gmail.com

4. Check inbox!
""")
        return
    
    # Determine recipients
    recipients = args.test if args.test else []
    
    if not recipients:
        print("\nNo recipients specified!")
        print("Usage: python test_guerrilla_email.py --test email1@example.com email2@example.com")
        print("\nExample:")
        print("  python test_guerrilla_email.py --test akiniobong19@gmail.com idona@who.int")
        return
    
    # Determine which cyclone data to use
    if args.send_freddy:
        alert_data = CYCLONE_FREDDY_TEST
        logger.info("Using Cyclone Freddy test data (420h warning)")
    else:
        alert_data = CYCLONE_IDAI_TEST
        logger.info("Using Cyclone Idai test data (84h warning)")
    
    # Send test
    result = send_test_alert(recipients, alert_data, is_test=True)
    
    if result["status"] == "success":
        print("\n" + "=" * 60)
        print("SUCCESS! Test email sent.")
        print("=" * 60)
        print("\nNEXT STEPS:")
        print("1. Check your inbox (and spam folder)")
        print("2. Verify the email looks professional")
        print("3. Confirm 'You might wanna check this' message is visible")
        print("4. If successful, proceed to send to real institutions")
        print("\nTo send to institutions later:")
        print("  python guerrilla_alerts.py --test mozambique")
    else:
        print(f"\nFailed: {result.get('error')}")
        print("\nRun --config for setup instructions")


if __name__ == "__main__":
    main()

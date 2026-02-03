"""
AFRO STORM Alert Service
========================
The actual mission: WARN COMMUNITIES. SAVE LIVES.

Supports:
- SMS (Twilio / Africa's Talking)
- WhatsApp
- Multilingual (English + Ibibio)
"""

import os
from typing import List, Dict, Optional
from enum import Enum
from dataclasses import dataclass
from datetime import datetime
from loguru import logger

# Optional imports for actual sending
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

try:
    import africastalking
    AFRICASTALKING_AVAILABLE = True
except ImportError:
    AFRICASTALKING_AVAILABLE = False


class AlertPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertType(Enum):
    CYCLONE = "cyclone"
    OUTBREAK = "outbreak"
    CONVERGENCE = "convergence"
    HEAT_STRESS = "heat_stress"
    FLOOD = "flood"


@dataclass
class Alert:
    id: str
    type: AlertType
    priority: AlertPriority
    title: str
    message_en: str
    message_ibibio: str
    location: Dict[str, float]  # {lat, lon}
    affected_regions: List[str]
    created_at: datetime
    data: Optional[Dict] = None


# 🔥 IBIBIO MESSAGE TEMPLATES
# These are the actual alerts that save lives
TEMPLATES = {
    AlertType.CYCLONE: {
        "en": """🌀 CYCLONE ALERT - {priority}

{title}

⚠️ A tropical cyclone is approaching {regions}.
Expected: {eta}
Wind speed: {wind_speed} km/h
Impact: {impact}

ACTIONS:
1. Move to higher ground
2. Secure loose items
3. Store water and food
4. Listen to local radio

Stay safe. The Grid watches over Africa.
- AFRO STORM""",

        "ibibio": """🌀 UFAN ETOP ESIT - {priority}

{title}

⚠️ Etop esit etemede ke {regions}.
Eti ekpe: {eta}
Ufan: {wind_speed} km/h
Eti ekpe: {impact}

NKPỌ NWED:
1. Kpọrọ ke ọkọ eti
2. Sie mme nkpọ ndiọnọ
3. Kwe mmọng ke ndiọ
4. Tie radio

Dịọng ikọ. Grid edide Africa.
- AFRO STORM"""
    },
    
    AlertType.OUTBREAK: {
        "en": """🔴 DISEASE OUTBREAK ALERT

{disease} outbreak in {location}

Cases: {cases}
Severity: {severity}

PROTECT YOURSELF:
1. Wash hands frequently
2. Avoid contact with sick people
3. Report symptoms to health center
4. Follow health guidelines

Stay vigilant. Stay healthy.
- AFRO STORM & WHO AFRO""",

        "ibibio": """🔴 UFAN USEM EKPE

{disease} ke {location}

Nkpọ mbuk: {cases}
Eti: {severity}

KPEME UWEM FO:
1. Swịọ ọbọ fo nke-nke
2. Kụọnọ mme nkpọ mbuk
3. Sịọ eti ke ọffiong
4. Tie ọkpọsịọng

Dịọng ikọ. Dịọng usem.
- AFRO STORM"""
    },
    
    AlertType.CONVERGENCE: {
        "en": """⚠️ CRITICAL CONVERGENCE ALERT

🌀 Cyclone + 🔴 Outbreak Detected

Location: {location}
Distance: {distance_km} km apart
Risk Score: {risk_score}/1.0

This is a HIGH-RISK situation:
- Cyclone may spread disease
- Flooding can contaminate water
- Evacuees may spread infection

IMMEDIATE ACTIONS:
1. Prepare for evacuation
2. Stock medications
3. Maintain hygiene supplies
4. Follow authority instructions

The Grid has detected convergence.
- AFRO STORM CRITICAL ALERT""",

        "ibibio": """⚠️ UFAN EKPEME ESIT

🌀 Etop + 🔴 Usem Ekpe

Eti: {location}
Mbọd: {distance_km} km
Eti ekpe: {risk_score}/1.0

ETI ESIT:
1. Kpọrọ ndiọ
2. Kwe usem
3. Sie mmọng
4. Tie nkpọ ọkpọsịọng

Grid edide eti esit.
- AFRO STORM"""
    },

    AlertType.HEAT_STRESS: {
        "en": """🔥 EXTREME HEAT ALERT

Temperature: {temperature}°C
Heat Index: {heat_index}
Duration: {duration}

STAY SAFE:
1. Stay indoors during peak hours
2. Drink plenty of water
3. Check on elderly neighbors
4. Avoid strenuous activity

- AFRO STORM""",

        "ibibio": """🔥 UFAN ESIT EFIK

Usọng: {temperature}°C
Eti: {heat_index}
Ọkọ: {duration}

DỊỌNG IKỌ:
1. Dịọng ke ọffiong
2. Mụng mmọng
3. Tie mme nkpọ eti
4. Kụọnọ nkpọ esit

- AFRO STORM"""
    }
}


class AlertService:
    """
    Core Alert Service
    
    Usage:
        service = AlertService()
        alert = service.create_cyclone_alert(cyclone_data, affected_regions)
        service.send_alert(alert, phone_numbers)
    """
    
    def __init__(self):
        self.twilio_client = None
        self.africastalking_client = None
        self.alerts_sent = []
        self.alerts_queue = []
        
        # Initialize Twilio if available
        if TWILIO_AVAILABLE:
            account_sid = os.getenv("TWILIO_ACCOUNT_SID")
            auth_token = os.getenv("TWILIO_AUTH_TOKEN")
            if account_sid and auth_token:
                self.twilio_client = TwilioClient(account_sid, auth_token)
                logger.info("✓ Twilio SMS initialized")
        
        # Initialize Africa's Talking if available
        if AFRICASTALKING_AVAILABLE:
            username = os.getenv("AFRICASTALKING_USERNAME")
            api_key = os.getenv("AFRICASTALKING_API_KEY")
            if username and api_key:
                africastalking.initialize(username, api_key)
                self.africastalking_client = africastalking.SMS
                logger.info("✓ Africa's Talking SMS initialized")
    
    def create_cyclone_alert(
        self,
        cyclone_data: Dict,
        affected_regions: List[str],
        priority: AlertPriority = AlertPriority.HIGH
    ) -> Alert:
        """Create a cyclone warning alert"""
        template = TEMPLATES[AlertType.CYCLONE]
        
        # Format messages
        format_data = {
            "priority": priority.value.upper(),
            "title": cyclone_data.get("name", "Tropical System"),
            "regions": ", ".join(affected_regions),
            "eta": cyclone_data.get("eta", "24-48 hours"),
            "wind_speed": cyclone_data.get("wind_speed", "Unknown"),
            "impact": cyclone_data.get("impact", "Strong winds and heavy rain expected")
        }
        
        return Alert(
            id=f"CYC-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            type=AlertType.CYCLONE,
            priority=priority,
            title=f"Cyclone Alert: {cyclone_data.get('name', 'Unknown')}",
            message_en=template["en"].format(**format_data),
            message_ibibio=template["ibibio"].format(**format_data),
            location=cyclone_data.get("location", {"lat": 0, "lon": 0}),
            affected_regions=affected_regions,
            created_at=datetime.now(),
            data=cyclone_data
        )
    
    def create_convergence_alert(
        self,
        convergence_data: Dict
    ) -> Alert:
        """Create a convergence (cyclone + outbreak) alert"""
        template = TEMPLATES[AlertType.CONVERGENCE]
        
        format_data = {
            "location": convergence_data.get("location", "Unknown"),
            "distance_km": convergence_data.get("distance_km", 0),
            "risk_score": convergence_data.get("risk_score", 0)
        }
        
        return Alert(
            id=f"CONV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            type=AlertType.CONVERGENCE,
            priority=AlertPriority.CRITICAL,
            title="Critical Convergence Detected",
            message_en=template["en"].format(**format_data),
            message_ibibio=template["ibibio"].format(**format_data),
            location=convergence_data.get("center", {"lat": 0, "lon": 0}),
            affected_regions=convergence_data.get("regions", []),
            created_at=datetime.now(),
            data=convergence_data
        )
    
    def create_outbreak_alert(
        self,
        outbreak_data: Dict
    ) -> Alert:
        """Create a disease outbreak alert"""
        template = TEMPLATES[AlertType.OUTBREAK]
        
        format_data = {
            "disease": outbreak_data.get("disease", "Unknown Disease"),
            "location": outbreak_data.get("location", "Unknown Location"),
            "cases": outbreak_data.get("cases", 0),
            "severity": outbreak_data.get("severity", "unknown")
        }
        
        return Alert(
            id=f"OUT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            type=AlertType.OUTBREAK,
            priority=AlertPriority.HIGH if outbreak_data.get("severity") == "high" else AlertPriority.MEDIUM,
            title=f"Outbreak Alert: {outbreak_data.get('disease', 'Unknown')}",
            message_en=template["en"].format(**format_data),
            message_ibibio=template["ibibio"].format(**format_data),
            location=outbreak_data.get("location_coords", {"lat": 0, "lon": 0}),
            affected_regions=[outbreak_data.get("country", "Unknown")],
            created_at=datetime.now(),
            data=outbreak_data
        )
    
    def send_sms(
        self,
        alert: Alert,
        phone_numbers: List[str],
        language: str = "en"
    ) -> Dict:
        """Send SMS alert to phone numbers"""
        message = alert.message_en if language == "en" else alert.message_ibibio
        results = {"sent": 0, "failed": 0, "details": []}
        
        for phone in phone_numbers:
            try:
                if self.twilio_client:
                    # Use Twilio
                    from_number = os.getenv("TWILIO_FROM_NUMBER")
                    self.twilio_client.messages.create(
                        body=message,
                        from_=from_number,
                        to=phone
                    )
                    results["sent"] += 1
                    results["details"].append({"phone": phone, "status": "sent", "provider": "twilio"})
                    
                elif self.africastalking_client:
                    # Use Africa's Talking
                    response = self.africastalking_client.send(message, [phone])
                    results["sent"] += 1
                    results["details"].append({"phone": phone, "status": "sent", "provider": "africastalking"})
                    
                else:
                    # Log only (no SMS provider configured)
                    logger.warning(f"SMS not sent (no provider): {phone}")
                    results["details"].append({"phone": phone, "status": "no_provider"})
                    
            except Exception as e:
                logger.error(f"SMS failed to {phone}: {e}")
                results["failed"] += 1
                results["details"].append({"phone": phone, "status": "failed", "error": str(e)})
        
        # Log alert
        self.alerts_sent.append({
            "alert_id": alert.id,
            "type": alert.type.value,
            "priority": alert.priority.value,
            "recipients": len(phone_numbers),
            "sent": results["sent"],
            "failed": results["failed"],
            "timestamp": datetime.now().isoformat()
        })
        
        logger.info(f"📱 Alert {alert.id}: {results['sent']}/{len(phone_numbers)} SMS sent")
        return results
    
    def send_whatsapp(
        self,
        alert: Alert,
        phone_numbers: List[str],
        language: str = "en"
    ) -> Dict:
        """Send WhatsApp alert (via Twilio)"""
        message = alert.message_en if language == "en" else alert.message_ibibio
        results = {"sent": 0, "failed": 0, "details": []}
        
        if not self.twilio_client:
            logger.warning("WhatsApp not available (Twilio not configured)")
            return results
        
        for phone in phone_numbers:
            try:
                from_whatsapp = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
                self.twilio_client.messages.create(
                    body=message,
                    from_=from_whatsapp,
                    to=f"whatsapp:{phone}"
                )
                results["sent"] += 1
                results["details"].append({"phone": phone, "status": "sent"})
                
            except Exception as e:
                logger.error(f"WhatsApp failed to {phone}: {e}")
                results["failed"] += 1
                results["details"].append({"phone": phone, "status": "failed", "error": str(e)})
        
        logger.info(f"📲 Alert {alert.id}: {results['sent']}/{len(phone_numbers)} WhatsApp sent")
        return results
    
    def get_alert_history(self) -> List[Dict]:
        """Get history of sent alerts"""
        return self.alerts_sent
    
    def preview_alert(self, alert: Alert, language: str = "en") -> str:
        """Preview alert message without sending"""
        return alert.message_en if language == "en" else alert.message_ibibio


# Singleton instance
alert_service = AlertService()


# Quick test
if __name__ == "__main__":
    service = AlertService()
    
    # Test cyclone alert
    cyclone = {
        "name": "Cyclone Freddy",
        "wind_speed": 185,
        "eta": "12 hours",
        "impact": "Severe flooding and wind damage expected",
        "location": {"lat": -19.0, "lon": 47.0}
    }
    
    alert = service.create_cyclone_alert(cyclone, ["Madagascar", "Mozambique"])
    
    print("=== ENGLISH ===")
    print(service.preview_alert(alert, "en"))
    print("\n=== IBIBIO ===")
    print(service.preview_alert(alert, "ibibio"))

"""
Ibibio Language Processor
Natural language processing for Nigerian Ibibio language
Enables early warnings in indigenous African languages
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from loguru import logger

@dataclass
class IbibioTranslation:
    """Translation result with cultural context"""
    text: str
    pronunciation_guide: Optional[str]
    cultural_notes: Optional[str]
    dialect: str = "standard"  # standard, Annang, Eket, etc.

class IbibioProcessor:
    """
    Ibibio Language Processor
    
    Translates emergency alerts and health information into Ibibio,
    a language spoken by ~10 million people in Nigeria's Akwa Ibom and Cross River states.
    
    Features:
    - Translation with cultural adaptation
    - Pronunciation guides
    - Dialect awareness
    - Emergency vocabulary
    """
    
    # Core emergency vocabulary
    EMERGENCY_TERMS = {
        "cyclone": {
            "ibibio": "ufọk mbre",
            "literal": "wind house",
            "pronunciation": "uh-FOK mm-BRAY"
        },
        "storm": {
            "ibibio": "mbre",
            "literal": "wind",
            "pronunciation": "mm-BRAY"
        },
        "flood": {
            "ibibio": "mbuọ",
            "literal": "water rising",
            "pronunciation": "mm-BWOR"
        },
        "disease": {
            "ibibio": "idòk",
            "literal": "sickness",
            "pronunciation": "ee-DOK"
        },
        "outbreak": {
            "ibibio": "idòk esan",
            "literal": "sickness spreading",
            "pronunciation": "ee-DOK eh-SAN"
        },
        "cholera": {
            "ibibio": "idòk nsu",
            "literal": "water sickness (severe diarrhea)",
            "pronunciation": "ee-DOK mm-SOO"
        },
        "evacuate": {
            "ibibio": "sio",
            "literal": "leave/move away",
            "pronunciation": "SEE-oh"
        },
        "warning": {
            "ibibio": "ntid",
            "literal": "alert/warning",
            "pronunciation": "n-TEED"
        },
        "danger": {
            "ibibio": "ndik",
            "literal": "something bad",
            "pronunciation": "n-DEEK"
        },
        "safe": {
            "ibibio": "ọnọ",
            "literal": "good/peaceful",
            "pronunciation": "oh-NOH"
        },
        "water": {
            "ibibio": "mmọ",
            "literal": "water",
            "pronunciation": "mm-MO"
        },
        "medicine": {
            "ibibio": "ọfọn",
            "literal": "medicine/healing",
            "pronunciation": "oh-FON"
        },
        "hospital": {
            "ibibio": "ufọk idòk",
            "literal": "sickness house",
            "pronunciation": "uh-FOK ee-DOK"
        },
        "doctor": {
            "ibibio": "ọdọk",
            "literal": "healer",
            "pronunciation": "oh-DOK"
        },
        "help": {
            "ibibio": "nyịn",
            "literal": "assistance",
            "pronunciation": "nyeen"
        },
        "now": {
            "ibibio": "ụtọn",
            "literal": "this time",
            "pronunciation": "uh-TON"
        },
        "immediately": {
            "ibibio": "ụtọn mmọ",
            "literal": "water time (right now)",
            "pronunciation": "uh-TON mm-MO"
        }
    }
    
    # Common phrases for emergency communication
    PHRASES = {
        "greeting_emergency": {
            "ibibio": "Abadie! Ntid ndik!",
            "english": "Attention! Danger warning!",
            "pronunciation": "ah-bah-DEE-eh, n-TEED n-DEEK"
        },
        "evacuate_now": {
            "ibibio": "Sio ụtọn! Mbuọ esie!",
            "english": "Leave now! Flood is coming!",
            "pronunciation": "SEE-oh uh-TON, mm-BWOR eh-see-EH"
        },
        "seek_high_ground": {
            "ibibio": "Kee nnon obot ọnọ.",
            "english": "Go to high ground.",
            "pronunciation": "keh non oh-BOT oh-NOH"
        },
        "boil_water": {
            "ibibio": "Kup mmọ. Mmọ adak ọnọ.",
            "english": "Boil water. Water must be good.",
            "pronunciation": "KOOP mm-MO, mm-MO ah-DAHK oh-NOH"
        },
        "wash_hands": {
            "ibibio": "Kpaan ukot. Kpaan mmọ.",
            "english": "Wash hands. Wash with water.",
            "pronunciation": "k-PAHN oo-KOT, k-PAHN mm-MO"
        },
        "cholera_symptoms": {
            "ibibio": "Idòk nsu: mmọ esan, ukpọnkpọk. Sio nke ufọk idòk.",
            "english": "Cholera: watery stool, vomiting. Go to hospital.",
            "pronunciation": "ee-DOK mm-SOO, mm-MO eh-SAN, oo-kpon-k-POK"
        },
        "help_coming": {
            "ibibio": "Nyịn esie. Kpọk ọdọk.",
            "english": "Help is coming. Call doctor.",
            "pronunciation": "nyeen eh-see-EH, k-POK oh-DOK"
        },
        "stay_together": {
            "ibibio": "Dia mmọ. Ete esan idem.",
            "english": "Stay together. Family protects body.",
            "pronunciation": "dee-AH mm-MO, eh-TEH eh-SAN ee-DEM"
        }
    }
    
    def __init__(self):
        self.ready = True
        logger.info("🗣️ Ibibio Language Processor initialized")
    
    def translate_term(self, english_term: str) -> Optional[IbibioTranslation]:
        """Translate a single emergency term"""
        term = english_term.lower().strip()
        
        if term in self.EMERGENCY_TERMS:
            data = self.EMERGENCY_TERMS[term]
            return IbibioTranslation(
                text=data["ibibio"],
                pronunciation_guide=data["pronunciation"],
                cultural_notes=f"Literal: {data['literal']}",
                dialect="standard"
            )
        
        return None
    
    def translate_reading(self, ifa_reading: Dict) -> Dict:
        """Translate Ifá reading to Ibibio with cultural context"""
        
        # Map Odù names to Ibibio equivalents/concepts
        odu_ibibio_map = {
            "Ogbe": {
                "name": "Ògbè → Òfọ̀n",
                "meaning": "Ìmọ̀ ìmọ̀, ìmọ́lẹ̀ sí òkúnkùn",
                "interpretation": "Ọ̀nà hà ṣe hàn. Ṣiṣẹ́ pẹ̀lú ìgboyà."
            },
            "Oyeku": {
                "name": "Òyèkú → Òkú",
                "meaning": "Ikú, ayípadà, òkúnkùn ṣáájú owúrọ̀",
                "interpretation": "Ṣe àkóso fún ayípadà nlá. Dáàbò bo àwọn aláìlágbára."
            },
            "Obara": {
                "name": "Òbàrà → Àrá",
                "meaning": "Ayípadà líle, àrá, agbára",
                "interpretation": "Ṣiṣẹ́ pẹ̀lú ìpinnu. Ìgbésẹ kíákíá dáàbò bo ibi."
            },
            "Irosun": {
                "name": "Ìrosùn → Ìrònú",
                "meaning": "Ijà, ẹ̀bùn, iná àgbáyé",
                "interpretation": "Ìfaradà mú àmìn-òdò wá. Gba ẹ̀bùn tó yẹ kí o tó."
            }
        }
        
        odu_name = ifa_reading.get("odu_name", "Unknown")
        ibibio_data = odu_ibibio_map.get(odu_name, {
            "name": odu_name,
            "meaning": ifa_reading.get("meaning", ""),
            "interpretation": ifa_reading.get("interpretation", "")
        })
        
        # Translate guidance
        guidance = ifa_reading.get("guidance", "")
        ibibio_guidance = self._translate_guidance(guidance)
        
        # Translate ebo
        ebo = ifa_reading.get("ebo", "")
        ibibio_ebo = self._translate_ebo(ebo)
        
        return {
            "odu_name": ibibio_data["name"],
            "meaning": ibibio_data["meaning"],
            "interpretation": ibibio_data["interpretation"],
            "guidance": ibibio_guidance,
            "ebo": ibibio_ebo,
            "urgency": ifa_reading.get("urgency", "medium"),
            "original": ifa_reading,
            "cultural_context": "Ibibio and Yoruba share ancestral wisdom traditions"
        }
    
    def generate_alert(self, convergence: Dict, risk_score: float) -> str:
        """Generate emergency alert in Ibibio language"""
        
        outbreak = convergence.get("outbreak", {})
        cyclone = convergence.get("cyclone", {})
        distance = convergence.get("distance_km", 0)
        
        # Determine urgency level
        if risk_score > 0.8:
            urgency_phrase = "NTID NDIEK! (CRITICAL WARNING!)"
        elif risk_score > 0.6:
            urgency_phrase = "NTID! (WARNING!)"
        else:
            urgency_phrase = "NTID NDIDI! (CAUTION!)"
        
        # Build alert
        alert = f"""{urgency_phrase}

Abadie! (Attention!)

Mbre ({cyclone.get('threat_level', 'STORM').lower()}) esie.
Idòk {outbreak.get('disease', 'disease')} ńkpo {outbreak.get('location', 'here')}.

NKPO NDIEK (CRITICAL INFO):
- Idòk: {outbreak.get('disease', 'Unknown')} ({outbreak.get('cases', 0)} people sick)
- Mbre: {cyclone.get('threat_level', 'Storm')} coming
- Distance: {distance:.0f} km

Kini se ụtọn (What to do NOW):
1. Sio! (Evacuate!)
2. Kee nnon obot ọnọ (Go to high ground)
3. Kup mmọ (Boil water)
4. Kpaan ukot (Wash hands)
5. Sio nke ufọk idòk (Go to hospital if sick)

Kpọk ọdọk: [EMERGENCY NUMBER]

Ndik mbre! (Storm danger!)
Idòk esan! (Disease spreading!)

--
AFRO Storm + MoStar Grid
Ọfọn idem ọdọk (Health protection)"""
        
        return alert
    
    def translate_alert(self, english_alert: str, context: str = "general") -> IbibioTranslation:
        """Translate English alert to Ibibio"""
        
        # Simple keyword-based translation
        # In production, this would use a proper NMT model
        
        ibibio_text = english_alert
        
        # Replace known terms
        for eng, data in self.EMERGENCY_TERMS.items():
            ibibio_text = ibibio_text.replace(eng, data["ibibio"])
            ibibio_text = ibibio_text.replace(eng.capitalize(), data["ibibio"].capitalize())
        
        return IbibioTranslation(
            text=ibibio_text,
            pronunciation_guide="See individual terms",
            cultural_notes=f"Context: {context}",
            dialect="standard"
        )
    
    def get_pronunciation_audio(self, text: str) -> Optional[bytes]:
        """
        Generate pronunciation audio for Ibibio text
        Would integrate with TTS system in production
        """
        # Placeholder - would call TTS service
        logger.info(f"TTS requested for: {text[:50]}...")
        return None
    
    def get_vocabulary_lesson(self, topic: str = "emergency") -> List[Dict]:
        """Get vocabulary list for learning"""
        
        if topic == "emergency":
            return [
                {
                    "english": term,
                    "ibibio": data["ibibio"],
                    "pronunciation": data["pronunciation"],
                    "literal": data["literal"]
                }
                for term, data in self.EMERGENCY_TERMS.items()
            ]
        
        return []
    
    def _translate_guidance(self, guidance: str) -> str:
        """Translate Ifá guidance to Ibibio concepts"""
        # Map common guidance phrases
        mappings = {
            "Act with confidence": "Ṣiṣẹ́ pẹ̀lú ìgboyà",
            "The path is clear": "Ọ̀nà hà ṣe hàn",
            "Prepare for significant change": "Ṣe àkóso fún ayípadà nlá",
            "Protect the vulnerable": "Dáàbò bo àwọn aláìlágbára",
            "Act decisively": "Ṣiṣẹ́ pẹ̀lú ìpinnu",
            "Swift action prevents greater harm": "Ìgbésẹ kíákíá dáàbò bo ibi",
            "Seek higher ground": "Wa ibi gíga",
            "Beware false friends": "Mọ̀ọ́wò àwọn ọ̀rẹ́ òtítọ́"
        }
        
        for eng, ibibio in mappings.items():
            if eng in guidance:
                return ibibio
        
        return guidance  # Return original if no mapping
    
    def _translate_ebo(self, ebo: str) -> str:
        """Translate ebo (sacrifice/remedy) to Ibibio cultural context"""
        mappings = {
            "White cloth and light candle": "Aṣọ funfun àti kándúlà ìmọ́lẹ̀",
            "Black cloth and healing herbs": "Aṣọ dúdú àti ewé ìwòsàn",
            "Palm oil and cornmeal": "Òróró àti èlùbọ́",
            "Calabash and cool water": "Igá àti omi tútù",
            "Red cloth and kola nuts": "Aṣọ pupa àti ọbì",
            "Community feast and shared labor": "Ajẹyọ àgbáyé àti iṣẹ́ pọ̀"
        }
        
        return mappings.get(ebo, ebo)
    
    def detect_dialect(self, text: str) -> str:
        """Detect Ibibio dialect variant"""
        # Simplified detection based on word variants
        annang_markers = ["aññ", "ke", "me"]
        eket_markers = ["efi", "kpa"]
        
        text_lower = text.lower()
        
        for marker in annang_markers:
            if marker in text_lower:
                return "Annang"
        
        for marker in eket_markers:
            if marker in text_lower:
                return "Eket"
        
        return "standard"

# Cultural context notes for non-Ibibio speakers
CULTURAL_CONTEXT = """
Ibibio Language Notes:
- Ibibio is a tonal language (high, mid, low tones)
- Spoken primarily in Akwa Ibom State, Nigeria
- Part of the Benue-Congo language family
- Closely related to Annang and Eket dialects
- Traditionally uses oral transmission; written form developed recently
- Emergency communication respects elders and community hierarchy
- Direct commands are acceptable in crisis situations
"""

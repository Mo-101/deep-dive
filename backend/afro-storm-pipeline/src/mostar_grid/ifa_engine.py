"""
Ifá Reasoning Engine
Traditional African divination system for symbolic guidance
256 Odù patterns representing all possible situations
"""

import random
from typing import Dict, List, Optional
from dataclasses import dataclass
from loguru import logger

@dataclass
class OduPattern:
    """Odù Ifá pattern"""
    name: str
    yoruba_name: str
    binary_pattern: str  # 8 binary digits (0/1)
    meaning: str
    guidance: str
    ebo: str  # Sacrifice/remedy
    urgency: str  # low, medium, high, critical

class IfaReasoningEngine:
    """
    Ifá Divination System
    
    The 256 Odù patterns represent the complete set of possible situations
    in the universe. Each pattern provides:
    - Symbolic meaning
    - Guidance for action
    - Ebo (remedy/sacrifice)
    - Urgency level
    """
    
    # The 16 principal Odù (expanded to 256 with combinations)
    PRINCIPAL_ODU = {
        "00000000": OduPattern(
            name="Ogbe",
            yoruba_name="Ògbè",
            binary_pattern="00000000",
            meaning="Light, clarity, victory over darkness",
            guidance="Act with confidence. The path is clear.",
            ebo="White cloth and light candle",
            urgency="low"
        ),
        "00001111": OduPattern(
            name="Oyeku",
            yoruba_name="Òyèkú",
            binary_pattern="00001111",
            meaning="Death, transformation, darkness before dawn",
            guidance="Prepare for significant change. Protect the vulnerable.",
            ebo="Black cloth and healing herbs",
            urgency="high"
        ),
        "00110011": OduPattern(
            name="Iwori",
            yoruba_name="Ìwòrì",
            binary_pattern="00110011",
            meaning="Inversion, internal conflict, hidden forces",
            guidance="Look within. What seems bad may bring good.",
            ebo="Palm oil and cornmeal",
            urgency="medium"
        ),
        "00111100": OduPattern(
            name="Odi",
            yoruba_name="Òdí",
            binary_pattern="00111100",
            meaning="Container, womb, potential, protection",
            guidance="Nurture and protect. Hold space for growth.",
            ebo="Calabash and cool water",
            urgency="low"
        ),
        "01010101": OduPattern(
            name="Irosun",
            yoruba_name="Ìrosùn",
            binary_pattern="01010101",
            meaning="Suffering, sacrifice, spiritual fire",
            guidance="Endurance brings reward. Accept necessary sacrifice.",
            ebo="Red cloth and kola nuts",
            urgency="high"
        ),
        "01011010": OduPattern(
            name="Owonrin",
            yoruba_name="Òwónrín",
            binary_pattern="01011010",
            meaning="Rainbow, beauty after storm, hope",
            guidance="The storm will pass. Beauty emerges from chaos.",
            ebo="Multicolored beads",
            urgency="medium"
        ),
        "01100110": OduPattern(
            name="Obara",
            yoruba_name="Òbàrà",
            binary_pattern="01100110",
            meaning="Sudden transformation, thunder, authority",
            guidance="Act decisively. Swift action prevents greater harm.",
            ebo="Thunder stone and ram",
            urgency="critical"
        ),
        "01101001": OduPattern(
            name="Okanran",
            yoruba_name="Òkànràn",
            binary_pattern="01101001",
            meaning="Conflict, war, struggle, competition",
            guidance="Choose battles wisely. Negotiation preferred.",
            ebo="Iron tools and bitter kola",
            urgency="high"
        ),
        "10011001": OduPattern(
            name="Ogunda",
            yoruba_name="Ògúndá",
            binary_pattern="10011001",
            meaning="Warrior spirit, iron, determination",
            guidance="Stand firm. Use strength to protect, not destroy.",
            ebo="Iron chain and palm wine",
            urgency="medium"
        ),
        "10010110": OduPattern(
            name="Osa",
            yoruba_name="Òsá",
            binary_pattern="10010110",
            meaning="Witchcraft, hidden enemies, deception",
            guidance="Beware false friends. Trust intuition.",
            ebo="White cloth and bitter herbs",
            urgency="high"
        ),
        "10101010": OduPattern(
            name="Eka",
            yoruba_name="Èká",
            binary_pattern="10101010",
            meaning="Strife, argument, division, gossip",
            guidance="Seek unity. Words can heal or harm.",
            ebo="Honey and reconciliation offering",
            urgency="medium"
        ),
        "10100101": OduPattern(
            name="Eturupon",
            yoruba_name="Ètùrúpon",
            binary_pattern="10100101",
            meaning="Cooperation, community, shared burden",
            guidance="Work together. Many hands make light work.",
            ebo="Community feast and shared labor",
            urgency="low"
        ),
        "11000011": OduPattern(
            name="Irete",
            yoruba_name="Ìretè",
            binary_pattern="11000011",
            meaning="Poverty, scarcity, need for patience",
            guidance="Conserve resources. Better times will come.",
            ebo="Small offering with patience",
            urgency="medium"
        ),
        "11001100": OduPattern(
            name="Ose",
            yoruba_name="Òsé",
            binary_pattern="11001100",
            meaning="Wealth, abundance, multiplication",
            guidance="Share blessings. Generosity brings more.",
            ebo="Yams and prosperity offering",
            urgency="low"
        ),
        "11110000": OduPattern(
            name="Ofun",
            yoruba_name="Òfún",
            binary_pattern="11110000",
            meaning="White, purity, spiritual elevation",
            guidance="Seek higher ground spiritually and physically.",
            ebo="White cloth and elevation sacrifice",
            urgency="medium"
        ),
        "11111111": OduPattern(
            name="Opira",
            yoruba_name="Òpìrá",
            binary_pattern="11111111",
            meaning="Complete darkness, unknown, mystery",
            guidance="Wait for light. Do not act in blindness.",
            ebo="Dark cloth and waiting period",
            urgency="critical"
        )
    }
    
    def __init__(self):
        self.ready = True
        logger.info("🔮 Ifá Reasoning Engine initialized")
    
    def is_ready(self) -> bool:
        return self.ready
    
    def perform_reading(
        self,
        situation_type: str,
        location: Dict[str, float],
        severity: str,
        question: Optional[str] = None
    ) -> Dict:
        """
        Perform Ifá divination for situation
        
        In traditional practice, this uses palm nuts or divining chain (opele)
        Here we use seeded random for reproducibility while maintaining symbolic meaning
        """
        # Seed based on situation for consistent readings
        seed = hash(f"{situation_type}{location}{severity}{question}") % 10000
        random.seed(seed)
        
        # Cast the Odù (select pattern)
        # In real Ifá, this would be determined by how the palm nuts fall
        pattern_keys = list(self.PRINCIPAL_ODU.keys())
        selected_key = random.choice(pattern_keys)
        odu = self.PRINCIPAL_ODU[selected_key]
        
        # Adjust interpretation based on situation
        interpretation = self._interpret_for_situation(odu, situation_type, severity)
        
        logger.info(f"Ifá reading: {odu.name} ({odu.yoruba_name}) for {situation_type}")
        
        return {
            "odu_name": odu.name,
            "yoruba_name": odu.yoruba_name,
            "binary_pattern": odu.binary_pattern,
            "meaning": odu.meaning,
            "interpretation": interpretation,
            "guidance": odu.guidance,
            "ebo": odu.ebo,
            "urgency": self._adjust_urgency(odu.urgency, severity),
            "question_answered": question,
            "timestamp": self._get_timestamp()
        }
    
    def _interpret_for_situation(
        self,
        odu: OduPattern,
        situation_type: str,
        severity: str
    ) -> str:
        """Adapt Odù meaning to specific situation"""
        
        interpretations = {
            "cyclone": {
                "Ogbe": "The storm's path is clear. Evacuation routes will remain open.",
                "Oyeku": "The storm brings death and destruction. Maximum preparation needed.",
                "Iwori": "The storm may shift unexpectedly. Monitor closely.",
                "Odi": "The storm's center will protect some while destroying others.",
                "Irosun": "The storm tests the community's strength. Sacrifice brings safety.",
                "Owonrin": "After the storm, rebuilding brings community together.",
                "Obara": "Sudden intensification likely. Act before it's too late.",
                "Okanran": "Conflict over evacuation decisions. Unity saves lives.",
                "Ogunda": "Strong winds test structures. Only the well-built survive.",
                "Osa": "Hidden dangers in the storm. Trust traditional warnings.",
                "Eka": "Disagreements about storm severity. Follow official guidance.",
                "Eturupon": "Community cooperation essential for survival.",
                "Irete": "Resources scarce after storm. Prepare supplies now.",
                "Ose": "Abundant help available. Accept assistance graciously.",
                "Ofun": "Elevation (high ground) brings safety. Move to higher ground.",
                "Opira": "Storm behavior unknown. Prepare for worst case."
            },
            "outbreak": {
                "Ogbe": "The disease pattern is clear. Containment possible.",
                "Oyeku": "High mortality expected. Aggressive intervention needed.",
                "Iwori": "Disease spreads through unexpected vectors. Investigate thoroughly.",
                "Odi": "Containment is possible. Quarantine effectively.",
                "Irosun": "Healthcare workers will suffer. Protect them.",
                "Owonrin": "Recovery brings immunity and understanding.",
                "Obara": "Sudden outbreak expansion. Act immediately.",
                "Okanran": "Community conflict over quarantine. Education needed.",
                "Ogunda": "Strong medicine required. Traditional and modern together.",
                "Osa": "Hidden transmission routes. Contact tracing essential.",
                "Eka": "Rumors spread faster than disease. Counter misinformation.",
                "Eturupon": "Community health workers key to containment.",
                "Irete": "Limited medical supplies. Triage necessary.",
                "Ose": "Abundant healing knowledge available. Share widely.",
                "Ofun": "Spiritual and physical healing both needed.",
                "Opira": "Unknown pathogen. Caution and research required."
            },
            "convergence": {
                "Ogbe": "The cyclone-outbreak convergence is manageable with preparation.",
                "Oyeku": "Deadly convergence. Historical pattern of high mortality.",
                "Iwori": "Unexpected interactions between storm and disease. Flexible response.",
                "Odi": "Containment possible despite storm. Secure facilities.",
                "Irosun": "Great sacrifice required. Some communities must be abandoned.",
                "Owonrin": "After the crisis, stronger health systems emerge.",
                "Obara": "Catastrophic flooding + disease surge imminent. Evacuate now.",
                "Okanran": "Conflict over resource allocation. Fair distribution critical.",
                "Ogunda": "Strong infrastructure survives. Weak systems collapse.",
                "Osa": "Hidden vulnerabilities exposed. Comprehensive assessment needed.",
                "Eka": "Disputes between health and disaster teams. Unified command.",
                "Eturupon": "Only collective action can address converging threats.",
                "Irete": "Resource scarcity amplified by dual crisis. International aid.",
                "Ose": "Abundant lessons from past convergences. Apply knowledge.",
                "Ofun": "Elevation protects from both flood and disease vectors.",
                "Opira": "Unprecedented convergence. No historical parallel. Maximum caution."
            }
        }
        
        default_interpretation = f"The {odu.name} Odù speaks to this situation: {odu.meaning}"
        
        return interpretations.get(situation_type, {}).get(odu.name, default_interpretation)
    
    def _adjust_urgency(self, base_urgency: str, severity: str) -> str:
        """Adjust urgency based on situation severity"""
        urgency_levels = ["low", "medium", "high", "critical"]
        
        base_idx = urgency_levels.index(base_urgency)
        
        if severity == "high":
            return urgency_levels[min(base_idx + 1, 3)]
        elif severity == "critical":
            return "critical"
        
        return base_urgency
    
    def _get_timestamp(self) -> str:
        from datetime import datetime
        return datetime.now().isoformat()
    
    def get_all_odu(self) -> List[Dict]:
        """Get all 256 Odù patterns (16 principal for now)"""
        return [
            {
                "name": o.name,
                "yoruba_name": o.yoruba_name,
                "binary_pattern": o.binary_pattern,
                "meaning": o.meaning
            }
            for o in self.PRINCIPAL_ODU.values()
        ]

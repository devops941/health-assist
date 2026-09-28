"""Rule-based red-flag / emergency detection.

Runs *before* any Groq call so that urgent symptoms are escalated even if the
LLM is unavailable. Rules are intentionally conservative and keyword-based;
they are a safety net, not a diagnosis.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

EMERGENCY_NUMBERS = {
    "US": "911",
    "IN": "112 / 108 (ambulance)",
    "UK": "999",
    "EU": "112",
    "AU": "000",
}


@dataclass(frozen=True)
class RedFlagRule:
    code: str
    label: str
    severity: str  # critical | high
    patterns: tuple[str, ...]
    advice: str


@dataclass
class RedFlagResult:
    triggered: bool = False
    severity: str = "none"
    matched: list[str] = field(default_factory=list)
    labels: list[str] = field(default_factory=list)
    advice: str = ""
    emergency_numbers: dict[str, str] = field(default_factory=lambda: dict(EMERGENCY_NUMBERS))

    def as_dict(self) -> dict:
        return {
            "triggered": self.triggered,
            "severity": self.severity,
            "matched_rules": self.matched,
            "labels": self.labels,
            "advice": self.advice,
            "emergency_numbers": self.emergency_numbers,
        }


RULES: tuple[RedFlagRule, ...] = (
    RedFlagRule(
        code="CARDIAC_CHEST_PAIN",
        label="Chest pain or pressure",
        severity="critical",
        patterns=(
            r"chest pain",
            r"chest pressure",
            r"crushing chest",
            r"pain in (my |the )?chest",
            r"tightness in (my |the )?chest",
        ),
        advice="Chest pain or pressure can signal a heart attack. Call emergency services now.",
    ),
    RedFlagRule(
        code="BREATHING_DIFFICULTY",
        label="Severe difficulty breathing",
        severity="critical",
        patterns=(
            r"can'?t breathe",
            r"cannot breathe",
            r"difficulty breathing",
            r"trouble breathing",
            r"shortness of breath",
            r"gasping for air",
            r"choking",
        ),
        advice="Severe breathing difficulty is a medical emergency. Seek help immediately.",
    ),
    RedFlagRule(
        code="STROKE_SIGNS",
        label="Possible stroke signs",
        severity="critical",
        patterns=(
            r"face droop",
            r"slurred speech",
            r"can'?t speak",
            r"sudden numbness",
            r"weakness on one side",
            r"sudden vision loss",
            r"sudden confusion",
        ),
        advice="These may be stroke warning signs. Call emergency services immediately.",
    ),
    RedFlagRule(
        code="SEVERE_BLEEDING",
        label="Severe or uncontrolled bleeding",
        severity="critical",
        patterns=(
            r"severe bleeding",
            r"heavy bleeding",
            r"bleeding a lot",
            r"won'?t stop bleeding",
            r"coughing up blood",
            r"vomiting blood",
        ),
        advice="Uncontrolled bleeding needs emergency care now.",
    ),
    RedFlagRule(
        code="SELF_HARM",
        label="Self-harm or suicidal thoughts",
        severity="critical",
        patterns=(
            r"suicid",
            r"kill myself",
            r"end my life",
            r"self[- ]harm",
            r"hurt myself",
            r"want to die",
        ),
        advice=(
            "You are not alone. Please contact a crisis helpline or emergency services "
            "right now and reach out to someone you trust."
        ),
    ),
    RedFlagRule(
        code="ANAPHYLAXIS",
        label="Severe allergic reaction",
        severity="critical",
        patterns=(
            r"anaphyla",
            r"throat (is )?closing",
            r"swelling of (my )?(throat|tongue|face)",
            r"severe allergic reaction",
        ),
        advice="A severe allergic reaction is an emergency. Use an epinephrine auto-injector if available and call for help.",
    ),
    RedFlagRule(
        code="NEURO_SEVERE",
        label="Severe neurological symptoms",
        severity="critical",
        patterns=(
            r"worst headache",
            r"severe headache.*(sudden|worst)",
            r"seizure",
            r"unconscious",
            r"fainted",
            r"passed out",
            r"stiff neck.*fever",
        ),
        advice="Severe neurological symptoms need urgent assessment. Go to the nearest emergency department.",
    ),
    RedFlagRule(
        code="HIGH_FEVER_INFANT",
        label="High fever in infant",
        severity="high",
        patterns=(
            r"baby.*(high )?fever",
            r"infant.*(high )?fever",
            r"newborn.*fever",
        ),
        advice="Fever in a young infant can be serious. Contact a paediatrician or emergency service right away.",
    ),
    RedFlagRule(
        code="PREGNANCY_EMERGENCY",
        label="Pregnancy warning signs",
        severity="high",
        patterns=(
            r"pregnan.*(bleeding|severe pain|no movement)",
            r"baby (has )?stopped moving",
            r"severe abdominal pain.*pregnan",
        ),
        advice="These pregnancy symptoms need immediate medical attention.",
    ),
    RedFlagRule(
        code="SEVERE_DEHYDRATION",
        label="Signs of severe dehydration",
        severity="high",
        patterns=(
            r"no urine",
            r"haven'?t urinated",
            r"severe dehydration",
            r"sunken eyes",
            r"can'?t keep (any )?(water|fluids) down",
        ),
        advice="Severe dehydration needs urgent care, especially in children and older adults.",
    ),
)

_COMPILED = tuple(
    (rule, tuple(re.compile(p, re.IGNORECASE) for p in rule.patterns)) for rule in RULES
)

_SEVERITY_ORDER = {"none": 0, "high": 1, "critical": 2}


def check_red_flags(text: str) -> RedFlagResult:
    """Scan free text for emergency warning signs."""
    result = RedFlagResult()
    if not text:
        return result

    normalized = text.lower()
    highest = "none"
    for rule, patterns in _COMPILED:
        if any(p.search(normalized) for p in patterns):
            result.matched.append(rule.code)
            result.labels.append(rule.label)
            if _SEVERITY_ORDER[rule.severity] > _SEVERITY_ORDER[highest]:
                highest = rule.severity
                result.advice = rule.advice

    if result.matched:
        result.triggered = True
        result.severity = highest
    return result


def is_emergency(text: str) -> bool:
    return check_red_flags(text).triggered

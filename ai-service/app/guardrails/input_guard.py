"""Input checks for the tutor: sanitise, and block prompt-injection / instruction-extraction attempts."""
import re
from dataclasses import dataclass

from ..services.text import clean
from .pii import redact

MAX_QUESTION_CHARS = 500

_INJECTION = [
    r"ignore\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?)",
    r"disregard\s+(?:all\s+|any\s+|the\s+|your\s+)?(?:previous|prior|above|earlier)?\s*(?:instructions?|prompts?|rules?)",
    r"(?:reveal|show|print|repeat|display|tell me)\s+(?:me\s+)?(?:your|the)\s+(?:system|hidden|initial|original)?\s*(?:prompt|instructions?)",
    r"\byou\s+are\s+now\b",
    r"\b(?:developer|dan|jailbreak|god)\s+mode\b",
    r"\bpretend\s+(?:to\s+be|you\s+are)\b",
    r"\bact\s+as\s+(?:if\s+you\s+(?:are|were)|an?\s+(?:unrestricted|unfiltered|different))",
    r"\bforget\s+(?:everything|all|your)\s+(?:above|previous|instructions?|rules?)",
    r"</?\s*(?:system|assistant)\s*>",
]
_INJECTION_RE = re.compile("|".join(_INJECTION), re.IGNORECASE)


@dataclass
class GuardResult:
    question: str
    blocked: bool = False
    reason: str = ""


def check_question(question: str) -> GuardResult:
    text = clean(question)[:MAX_QUESTION_CHARS]
    if len(text) < 3:
        return GuardResult(text, True, "empty")
    if _INJECTION_RE.search(text):
        return GuardResult(text, True, "prompt-injection")
    return GuardResult(redact(text))

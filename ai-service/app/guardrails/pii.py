"""Redact obvious personal data before text reaches an LLM provider or a log line."""
import re

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_NATIONAL_ID = re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b")  # 12-digit ids (e.g. Aadhaar style)
# Digit runs with common separators; accepted as a phone number when they hold 10-15 digits.
_PHONE_CANDIDATE = re.compile(r"(?<![\w.])[+(]?\d[\d\s().-]{8,}\d(?!\w)(?!\.\d)")


def _phone(match: re.Match[str]) -> str:
    digits = sum(ch.isdigit() for ch in match.group())
    return "[phone]" if 10 <= digits <= 15 else match.group()


def redact(text: str) -> str:
    text = _EMAIL.sub("[email]", text)
    text = _NATIONAL_ID.sub("[id-number]", text)  # strict 4-4-4 shape first
    return _PHONE_CANDIDATE.sub(_phone, text)

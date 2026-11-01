"""Tokenisation, light stemming and sentence splitting shared by retrieval, quizzes and guardrails."""
import re
from collections.abc import Iterable

STOPWORDS = frozenset(
    """a an and are as at be been being but by can could did do does for from had has have how i if in into is it its
    me my of on or our so than that the their them then there these they this to was we were what when where which
    who whom why will with would you your about also any each more most other some such only own same too very
    just not no nor over under again further once here both few between during before after above below up down out
    off while because until against through
    difference differences explain describe define definition meaning mean means tell give show use used using
    work works example examples compare comparison good better best need needed important happen happens
    hi hello hey please thanks thank confused confusing quick question questions help understand understanding
    wondering curious keep forgetting bit thing email phone""".split()
)

_TOKEN = re.compile(r"[a-z0-9]+")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(])")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean(text: str) -> str:
    return _CONTROL.sub("", text).strip()


def stem(word: str) -> str:
    """Deliberately conservative suffix stripping (no external NLP dependency)."""
    if len(word) <= 3 or word.isdigit():
        return word
    if word.endswith("ies") and len(word) >= 5:
        return word[:-3] + "y"
    if word.endswith("ing") and len(word) >= 6:
        return word[:-3]
    if word.endswith("ed") and len(word) >= 5:
        return word[:-2]
    # Plurals: "indexes"/"boxes"/"classes"/"matches" lose -es; "trees"/"nodes" lose only -s.
    if word.endswith(("sses", "xes", "zes", "ches", "shes")) and len(word) >= 5:
        return word[:-2]
    if word.endswith("s") and not word.endswith("ss") and len(word) >= 4:
        return word[:-1]
    return word


def words(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def tokens(text: str, *, bigrams: bool = True) -> list[str]:
    """Stemmed content words plus adjacent-word bigrams (helps phrase matches such as 'b tree')."""
    content = [stem(w) for w in words(text) if w not in STOPWORDS]
    out = list(content)
    if bigrams:
        out.extend(f"{a} {b}" for a, b in zip(content, content[1:]))
    return out


def content_stems(text: str) -> set[str]:
    return {stem(w) for w in words(text) if w not in STOPWORDS and len(w) > 2}


def split_sentences(text: str) -> list[str]:
    parts: list[str] = []
    for block in re.split(r"\n{2,}|\n", text):
        block = block.strip()
        if not block:
            continue
        pieces = [s.strip() for s in _SENTENCE_END.split(block) if s.strip()]
        # A block (e.g. a lesson description) may lack final punctuation; add it so joined text reads correctly.
        if pieces and pieces[-1][-1] not in ".!?:;":
            pieces[-1] += "."
        parts.extend(pieces)
    return parts


def dedupe(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = re.sub(r"\W+", " ", item.lower()).strip()
        if key and key not in seen:
            seen.add(key)
            out.append(item)
    return out

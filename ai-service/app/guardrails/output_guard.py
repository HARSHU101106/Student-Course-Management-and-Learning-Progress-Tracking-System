"""Output checks: keep only answer sentences that are supported by the retrieved context."""
import re

from ..services.text import content_stems, split_sentences

_TAGS = re.compile(r"<[^>]{0,200}>")
_CITATION = re.compile(r"\s*\[\d+\]")


def strip_markup(text: str) -> str:
    return _TAGS.sub("", text).strip()


def support(sentence: str, context_stems: list[set[str]]) -> float:
    """Fraction of a sentence's content words that appear in its best-matching context chunk."""
    stems = content_stems(sentence)
    if not stems:
        return 1.0
    return max((len(stems & chunk) / len(stems) for chunk in context_stems), default=0.0)


def keep_supported(answer: str, chunk_texts: list[str], *, min_support: float = 0.6) -> tuple[str, int, int]:
    """Returns (filtered_answer, kept, dropped). Sentences with weak lexical support are removed."""
    answer = strip_markup(answer)
    context = [content_stems(text) for text in chunk_texts]
    kept: list[str] = []
    dropped = 0
    for sentence in split_sentences(_CITATION.sub("", answer)):
        if support(sentence, context) >= min_support:
            kept.append(sentence)
        else:
            dropped += 1
    return " ".join(kept), len(kept), dropped

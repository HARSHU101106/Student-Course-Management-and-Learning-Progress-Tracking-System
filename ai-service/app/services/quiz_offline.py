"""Deterministic cloze-style multiple-choice generation from indexed lesson text.

Every question is built from a real sentence: one key term is blanked out and the distractors are
other key terms from the same course. The sentence itself becomes the explanation, so each answer
is verifiable against the source by construction. Output is always a *draft* for instructor review.
"""
import hashlib
import re
from typing import Any

from .store import CourseIndex
from .text import STOPWORDS, split_sentences, stem

_WORD = re.compile(r"[A-Za-z][A-Za-z-]{4,}")
_GENERIC = frozenset(
    "which their there these those should would could about between during example following because "
    "another other every often usually always called using used uses based within without while where "
    "whose being makes make takes take gives give allows allow ensures ensure keeps keep "
    "whereas whether although though since therefore however moreover instead rather might shall must "
    "large small never ever still already almost mostly simply directly quickly slowly".split()
)


def _digest(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:12], 16)


def _match_case(word: str, template: str) -> str:
    return word.capitalize() if template[:1].isupper() else word.lower()


def _candidates(sentence: str, idf: dict[str, float]) -> list[tuple[str, float]]:
    found: dict[str, float] = {}
    for match in _WORD.finditer(sentence):
        word = match.group()
        low = word.lower()
        if low in STOPWORDS or low in _GENERIC:
            continue
        weight = idf.get(stem(low))
        if weight is not None:
            found.setdefault(low, weight)
    return sorted(found.items(), key=lambda item: -item[1])


def generate_cloze(index: CourseIndex, *, lesson_id: str | None, count: int, difficulty: str) -> list[dict[str, Any]]:
    idf = index.model.idf
    scoped = [c for c in index.chunks if not lesson_id or c["lessonId"] == lesson_id]
    if not scoped:
        return []

    # Distractor pool: key terms from the whole course, so options look plausible.
    pool: dict[str, str] = {}  # term -> topic it first appears under
    for chunk in index.chunks:
        topic = (chunk.get("topics") or ["General"])[0]
        for sentence in split_sentences(chunk["text"]):
            for term, _ in _candidates(sentence, idf):
                pool.setdefault(term, topic)

    per_chunk: list[list[dict[str, Any]]] = []
    for chunk in scoped:
        rows = []
        for sentence in split_sentences(chunk["text"]):
            if not 50 <= len(sentence) <= 240:
                continue
            terms = _candidates(sentence, idf)
            if not terms:
                continue
            ranked = [term for term, _ in terms]
            if difficulty == "hard":
                ordered_terms = ranked[: min(4, len(ranked))]
            elif difficulty == "easy":
                ordered_terms = list(reversed(ranked[: min(4, len(ranked))]))
            else:
                middle = max(1, len(ranked) // 2)
                ordered_terms = ranked[max(0, middle - 1): min(len(ranked), middle + 3)]
            for term in ordered_terms:
                rows.append({"sentence": sentence, "term": term, "chunk": chunk})
        per_chunk.append(rows)

    # Round-robin across chunks so questions cover different material.
    ordered: list[dict[str, Any]] = []
    depth = 0
    while any(depth < len(rows) for rows in per_chunk):
        ordered.extend(rows[depth] for rows in per_chunk if depth < len(rows))
        depth += 1

    questions: list[dict[str, Any]] = []
    seen_prompts: set[str] = set()
    for row in ordered:
        if len(questions) >= count:
            break
        sentence, term, chunk = row["sentence"], row["term"], row["chunk"]
        blank = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
        if not blank.search(sentence):
            continue
        original = blank.search(sentence).group()
        prompt_text = blank.sub("______", sentence)
        prompt_key = prompt_text.lower()
        if prompt_key in seen_prompts:
            continue
        seen_prompts.add(prompt_key)

        topic = (chunk.get("topics") or ["General"])[0]

        # Prefer distractors from the same topic, then similar length, then a stable hash.
        distractors = sorted(
            (
                t for t in pool
                if t != term and stem(t) != stem(term) and abs(len(t) - len(term)) <= 5
            ),
            key=lambda t: (pool[t] != topic, abs(len(t) - len(term)), _digest(sentence, t)),
        )[:3]

        if len(distractors) < 3:
            sentence_words = [
                w for w in _WORD.findall(sentence)
                if w.lower() != term.lower() and stem(w.lower()) != stem(term) and w.lower() not in STOPWORDS and w.lower() not in _GENERIC
            ]
            distractors = sorted(
                set(distractors + sentence_words[:3]),
                key=lambda t: (_digest(sentence, t), t.lower()),
            )[:3]

        if len(distractors) < 3:
            continue

        options = [_match_case(t, original) for t in [term, *distractors]]
        options.sort(key=lambda o: _digest(sentence, "order", o))
        question = {
            "prompt": f"Fill in the blank: {prompt_text}",
            "options": options,
            "answerIndex": options.index(_match_case(term, original)),
            "explanation": sentence,
            "topic": topic,
            "difficulty": difficulty,
        }
        questions.append(question)
    return questions

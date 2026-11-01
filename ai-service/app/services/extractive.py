"""Deterministic, always-grounded answer composition used when no LLM is configured or it fails."""
from collections import Counter
from typing import Any

from .retrieval import Hit
from .text import split_sentences, tokens
from .tfidf import TfidfModel


def best_sentences(question: str, hits: list[Hit], model: TfidfModel, *, limit: int = 3) -> list[tuple[Hit, str]]:
    """Rank sentences from the retrieved chunks by IDF-weighted overlap with the question."""
    q_terms = Counter(t for t in tokens(question, bigrams=False) if t in model.idf)
    scored: list[tuple[float, int, int, Hit, str]] = []
    for rank, hit in enumerate(hits):
        for position, sentence in enumerate(split_sentences(hit.chunk["text"])):
            s_terms = set(tokens(sentence, bigrams=False))
            overlap = sum(model.idf[t] * count for t, count in q_terms.items() if t in s_terms)
            if overlap > 0:
                # Slightly prefer sentences from higher-ranked chunks.
                scored.append((overlap / (1 + 0.15 * rank), rank, position, hit, sentence))
    scored.sort(key=lambda row: -row[0])
    chosen = scored[:limit]
    chosen.sort(key=lambda row: (row[1], row[2]))  # read in source order
    return [(row[3], row[4]) for row in chosen]


def compose(question: str, hits: list[Hit], model: TfidfModel) -> tuple[str, list[dict[str, Any]]]:
    """Join the best sentences, with one citation marker per lesson group (not per sentence)."""
    picked = best_sentences(question, hits, model)
    if not picked:
        picked = [(hits[0], split_sentences(hits[0].chunk["text"])[0])]

    groups: list[tuple[str, list[str]]] = []
    citations: list[dict[str, Any]] = []
    for hit, sentence in picked:
        lesson_id = hit.chunk["lessonId"]
        if groups and groups[-1][0] == lesson_id:
            groups[-1][1].append(sentence)
            continue
        groups.append((lesson_id, [sentence]))
        if not any(c["lessonId"] == lesson_id for c in citations):
            citations.append(citation(hit))
    number = {c["lessonId"]: i for i, c in enumerate(citations, 1)}
    return " ".join(f"{' '.join(sentences)} [{number[lesson_id]}]" for lesson_id, sentences in groups), citations


def citation(hit: Hit) -> dict[str, Any]:
    text = hit.chunk["text"]
    return {
        "lessonId": hit.chunk["lessonId"],
        "title": hit.chunk["title"],
        "order": hit.chunk.get("order", 0),
        "snippet": text if len(text) <= 220 else text[:217].rstrip() + "...",
        "score": round(hit.score, 3),
    }

"""Index building and top-k retrieval."""
from dataclasses import dataclass
from typing import Any

from .chunking import chunk_lesson
from .store import CourseIndex, Store
from .tfidf import TfidfModel, cosine

LESSON_BOOST = 0.08


@dataclass
class Hit:
    chunk: dict[str, Any]
    score: float


def build_index(store: Store, course_id: str, lessons: list[dict[str, Any]]) -> tuple[int, int]:
    """Chunk every lesson, fit a TF-IDF model on the course and persist it. Returns (lessons, chunks)."""
    chunks: list[dict[str, Any]] = []
    for lesson in lessons:
        chunks.extend(chunk_lesson(lesson))
    model = TfidfModel.fit([c["indexText"] for c in chunks]) if chunks else TfidfModel({}, 0)
    for chunk in chunks:
        chunk["vector"] = model.vectorize(chunk["indexText"])
    store.replace_course(course_id, chunks, model)
    return len(lessons), len(chunks)


def search(index: CourseIndex, query: str, *, k: int = 4, lesson_id: str | None = None) -> list[Hit]:
    qvec = index.model.vectorize(query, penalize_unknown=True)
    if not qvec:
        return []
    hits = []
    for chunk in index.chunks:
        score = cosine(qvec, chunk["vector"])
        if score <= 0:
            continue
        if lesson_id and chunk["lessonId"] == lesson_id:
            score += LESSON_BOOST
        hits.append(Hit(chunk, score))
    hits.sort(key=lambda hit: hit.score, reverse=True)
    return hits[:k]

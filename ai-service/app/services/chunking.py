"""Split lesson text into overlapping sentence windows that keep their lesson metadata."""
from typing import Any

from .text import dedupe, split_sentences


def chunk_lesson(lesson: dict[str, Any], *, max_chars: int = 600, overlap: int = 1) -> list[dict[str, Any]]:
    sentences = dedupe(split_sentences(lesson.get("text", "")))
    if not sentences:
        return []

    windows: list[list[str]] = []
    current: list[str] = []
    size = 0
    for sentence in sentences:
        if current and size + len(sentence) > max_chars:
            windows.append(current)
            current = current[-overlap:] if overlap else []
            size = sum(len(s) for s in current)
        current.append(sentence)
        size += len(sentence)
    if current and (not windows or current != windows[-1][-len(current):]):
        windows.append(current)

    title = lesson.get("title", "")
    topics = lesson.get("topics", [])
    return [
        {
            "id": f"{lesson['id']}:{index}",
            "lessonId": lesson["id"],
            "title": title,
            "order": lesson.get("order", 0),
            "topics": topics,
            "videoId": lesson.get("videoId", ""),
            "text": " ".join(window),
            # Title and topics are indexed with the body so a question that names the lesson finds it.
            "indexText": f"{title}. {' '.join(topics)}. {' '.join(window)}",
        }
        for index, window in enumerate(windows)
    ]

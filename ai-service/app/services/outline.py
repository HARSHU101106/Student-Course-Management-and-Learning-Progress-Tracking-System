"""Heuristic course outline: tag lessons with topics and group them into modules."""
import re
from collections import Counter
from typing import Any

from .text import STOPWORDS, stem
from .tfidf import TfidfModel

_MODULE_MARKER = re.compile(r"\b(week|module|unit|chapter|part|section)\s*[-:]?\s*(\d+)\b", re.IGNORECASE)
_WORD = re.compile(r"[A-Za-z][A-Za-z+#-]{2,}")
TARGET_MODULE_SIZE = 6


def _keywords(text: str, frequent: set[str]) -> list[str]:
    seen: dict[str, str] = {}
    for word in _WORD.findall(text):
        low = word.lower()
        if low in STOPWORDS or stem(low) in frequent:
            continue
        seen.setdefault(stem(low), word)
    return list(seen.values())


def build_outline(items: list[dict[str, str]]) -> dict[str, Any]:
    texts = [f"{item['title']} {item.get('description', '')[:200]}" for item in items]
    model = TfidfModel.fit(texts)

    # Words present in most titles describe the whole course, not one lesson.
    doc_freq: Counter[str] = Counter()
    for item in items:
        doc_freq.update({stem(w.lower()) for w in _WORD.findall(item["title"])})
    cutoff = max(3, int(len(items) * 0.6))
    frequent = {term for term, count in doc_freq.items() if count >= cutoff}

    lesson_topics: list[list[str]] = []
    for item in items:
        words = _keywords(item["title"], frequent)
        words.sort(key=lambda w: -model.idf.get(stem(w.lower()), 0))
        lesson_topics.append([w if w.isupper() else w.capitalize() for w in words[:2]])

    markers = [_MODULE_MARKER.search(item["title"]) for item in items]
    modules: list[dict[str, Any]] = []
    assignment: list[str] = []

    if all(markers) and len({m.group(0).lower() for m in markers}) > 1:
        for marker, item in zip(markers, items):
            name = f"{marker.group(1).capitalize()} {marker.group(2)}"
            assignment.append(name)
    else:
        size = max(1, -(-len(items) // max(1, -(-len(items) // TARGET_MODULE_SIZE))))
        for start in range(0, len(items), size):
            group = lesson_topics[start:start + size]
            top = Counter(t for topics in group for t in topics).most_common(1)
            label = f"Part {start // size + 1}" + (f": {top[0][0]}" if top else "")
            assignment.extend([label] * len(items[start:start + size]))

    order: dict[str, list[str]] = {}
    for item, name in zip(items, assignment):
        order.setdefault(name, []).append(item["id"])
    modules = [{"name": name, "lessonIds": ids} for name, ids in order.items()]

    return {
        "lessons": [
            {"id": item["id"], "module": module, "topics": topics}
            for item, module, topics in zip(items, assignment, lesson_topics)
        ],
        "modules": modules,
    }

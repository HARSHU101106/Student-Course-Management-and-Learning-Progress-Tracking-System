"""Chunk stores: in-memory (dev/tests) and MongoDB (shared with the API, survives restarts)."""
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from .tfidf import TfidfModel


@dataclass
class CourseIndex:
    course_id: str
    version: float
    model: TfidfModel
    chunks: list[dict[str, Any]] = field(default_factory=list)  # each has a "vector" dict


class Store(Protocol):
    kind: str

    def replace_course(self, course_id: str, chunks: list[dict[str, Any]], model: TfidfModel) -> float: ...
    def version(self, course_id: str) -> float | None: ...
    def load(self, course_id: str) -> CourseIndex | None: ...
    def delete_course(self, course_id: str) -> int: ...
    def ping(self) -> bool: ...


class MemoryStore:
    kind = "memory"

    def __init__(self) -> None:
        self._data: dict[str, CourseIndex] = {}
        self._lock = threading.Lock()

    def replace_course(self, course_id, chunks, model):
        version = time.time()
        with self._lock:
            self._data[course_id] = CourseIndex(course_id, version, model, [dict(c) for c in chunks])
        return version

    def version(self, course_id):
        index = self._data.get(course_id)
        return index.version if index else None

    def load(self, course_id):
        return self._data.get(course_id)

    def delete_course(self, course_id):
        with self._lock:
            index = self._data.pop(course_id, None)
        return len(index.chunks) if index else 0

    def ping(self):
        return True


class MongoStore:
    """Uses two collections in the API's database: ai_chunks and ai_models."""

    kind = "mongo"

    def __init__(self, uri: str, db_name: str):
        from pymongo import ASCENDING, MongoClient

        self._client = MongoClient(uri, serverSelectionTimeoutMS=5000, appname="adaptlearn-ai")
        db = self._client[db_name]
        self._chunks = db["ai_chunks"]
        self._models = db["ai_models"]
        self._chunks.create_index([("courseId", ASCENDING)])

    def replace_course(self, course_id, chunks, model):
        version = time.time()
        docs = []
        for chunk in chunks:
            doc = {k: v for k, v in chunk.items() if k != "vector"}
            doc["courseId"] = course_id
            # Mongo field names cannot hold arbitrary terms, so vectors are stored as pairs.
            doc["vector"] = [[term, weight] for term, weight in chunk["vector"].items()]
            docs.append(doc)
        self._chunks.delete_many({"courseId": course_id})
        if docs:
            self._chunks.insert_many(docs)
        self._models.replace_one(
            {"_id": course_id},
            {"_id": course_id, "version": version, "model": [[t, w] for t, w in model.idf.items()], "nDocs": model.n_docs},
            upsert=True,
        )
        return version

    def version(self, course_id):
        row = self._models.find_one({"_id": course_id}, {"version": 1})
        return row["version"] if row else None

    def load(self, course_id):
        row = self._models.find_one({"_id": course_id})
        if not row:
            return None
        model = TfidfModel({t: w for t, w in row["model"]}, row["nDocs"])
        chunks = []
        for doc in self._chunks.find({"courseId": course_id}).sort("order", 1):
            doc.pop("_id", None)
            doc["vector"] = {t: w for t, w in doc["vector"]}
            chunks.append(doc)
        return CourseIndex(course_id, row["version"], model, chunks)

    def delete_course(self, course_id):
        removed = self._chunks.delete_many({"courseId": course_id}).deleted_count
        self._models.delete_one({"_id": course_id})
        return removed

    def ping(self):
        try:
            self._client.admin.command("ping")
            return True
        except Exception:
            return False


class IndexCache:
    """Avoids reloading a course from the store on every question; re-checks the version each time."""

    def __init__(self, store: Store):
        self.store = store
        self._cache: dict[str, CourseIndex] = {}

    def get(self, course_id: str) -> CourseIndex | None:
        version = self.store.version(course_id)
        if version is None:
            self._cache.pop(course_id, None)
            return None
        cached = self._cache.get(course_id)
        if cached and cached.version == version:
            return cached
        loaded = self.store.load(course_id)
        if loaded:
            self._cache[course_id] = loaded
        return loaded

    def invalidate(self, course_id: str) -> None:
        self._cache.pop(course_id, None)

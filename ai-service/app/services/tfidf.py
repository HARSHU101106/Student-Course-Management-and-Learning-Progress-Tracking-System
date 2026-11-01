"""Per-course TF-IDF model with sparse dict vectors and cosine similarity."""
import math
from collections import Counter

from .text import tokens

Vector = dict[str, float]


class TfidfModel:
    def __init__(self, idf: dict[str, float], n_docs: int):
        self.idf = idf
        self.n_docs = n_docs

    @classmethod
    def fit(cls, texts: list[str]) -> "TfidfModel":
        doc_tokens = [set(tokens(text)) for text in texts]
        n = len(doc_tokens)
        df: Counter[str] = Counter()
        for toks in doc_tokens:
            df.update(toks)
        idf = {term: math.log((1 + n) / (1 + count)) + 1.0 for term, count in df.items()}
        return cls(idf, n)

    def vectorize(self, text: str, *, penalize_unknown: bool = False) -> Vector:
        """L2-normalised TF-IDF vector.

        With penalize_unknown=True (used for questions) words that never occur in the course still count
        toward the norm, so a question that matches only one of its keywords scores low instead of
        looking like a perfect match for the single known word.
        """
        counts = Counter(t for t in tokens(text) if t in self.idf)
        vec = {t: (1 + math.log(c)) * self.idf[t] for t, c in counts.items()}
        norm_sq = sum(v * v for v in vec.values())
        if penalize_unknown and self.idf:
            typical = sum(self.idf.values()) / len(self.idf)
            unknown = {t for t in tokens(text, bigrams=False) if t not in self.idf}
            norm_sq += len(unknown) * typical * typical
        norm = math.sqrt(norm_sq)
        return {t: v / norm for t, v in vec.items()} if norm else {}

    def to_dict(self) -> dict:
        return {"idf": self.idf, "nDocs": self.n_docs}

    @classmethod
    def from_dict(cls, data: dict) -> "TfidfModel":
        return cls(dict(data["idf"]), int(data["nDocs"]))


def cosine(a: Vector, b: Vector) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(weight * b.get(term, 0.0) for term, weight in a.items())

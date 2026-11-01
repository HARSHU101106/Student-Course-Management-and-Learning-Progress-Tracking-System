"""Dependency container created once per app (and replaced wholesale in tests)."""
from dataclasses import dataclass

from ..config import Settings
from .llm import LLM
from .store import IndexCache, Store


@dataclass
class Deps:
    settings: Settings
    store: Store
    cache: IndexCache
    llm: LLM

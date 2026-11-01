"""Course Studio pipeline: tag lessons with topics, then group them into modules."""
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..services.outline import build_outline


class StudioState(TypedDict, total=False):
    items: list[dict[str, str]]
    outline: dict[str, Any]


def build_studio_graph():
    def outline(state: StudioState) -> StudioState:
        return {"outline": build_outline(state["items"])}

    graph = StateGraph(StudioState)
    graph.add_node("outline", outline)
    graph.add_edge(START, "outline")
    graph.add_edge("outline", END)
    return graph.compile()

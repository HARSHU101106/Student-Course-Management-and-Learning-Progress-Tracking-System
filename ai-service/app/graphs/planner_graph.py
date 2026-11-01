"""Planner pipeline: assess + select (rules) -> explain (optional LLM rephrase of the summary)."""
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..prompts import PLAN_SYSTEM
from ..services.container import Deps
from ..services.llm import LLMError
from ..services.planner_rules import build_plan, summarise


class PlanState(TypedDict, total=False):
    request: dict[str, Any]
    items: list[dict[str, Any]]
    facts: dict[str, Any]
    summary: str
    generated_by: str


def build_planner_graph(deps: Deps):
    def rules(state: PlanState) -> PlanState:
        req = state["request"]
        plan = build_plan(req["lessons"], req["completedLessonIds"], req["mastery"], req["weeklyHours"])
        return {"items": plan["items"], "facts": plan["facts"], "summary": summarise(plan["facts"]), "generated_by": "rules"}

    async def explain(state: PlanState) -> PlanState:
        if not deps.llm.available or not state["items"]:
            return {}
        lines = "\n".join(f"- {item['type']}: {item['title']} ({item['reason']})" for item in state["items"])
        try:
            text = (await deps.llm.complete(PLAN_SYSTEM, f"Plan:\n{lines}\n\nFacts: {state['facts']}", max_tokens=120)).strip()
        except LLMError:
            return {}
        return {"summary": text, "generated_by": "llm"} if text else {}

    graph = StateGraph(PlanState)
    graph.add_node("rules", rules)
    graph.add_node("explain", explain)
    graph.add_edge(START, "rules")
    graph.add_edge("rules", "explain")
    graph.add_edge("explain", END)
    return graph.compile()

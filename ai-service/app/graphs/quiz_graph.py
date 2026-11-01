"""Quiz pipeline: load index -> generate (LLM JSON, else offline cloze) -> validate."""
import json
import re
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..prompts import QUIZ_SYSTEM
from ..services.container import Deps
from ..services.llm import LLMError
from ..services.quiz_offline import generate_cloze


class QuizState(TypedDict, total=False):
    course_id: str
    lesson_id: str | None
    count: int
    difficulty: str
    index_missing: bool
    raw: list[dict[str, Any]]
    questions: list[dict[str, Any]]
    generated_by: str


def validate_question(raw: Any, default_topic: str = "General") -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    prompt = str(raw.get("prompt", "")).strip()
    options = [str(o).strip() for o in raw.get("options", []) if str(o).strip()] if isinstance(raw.get("options"), list) else []
    answer = raw.get("answerIndex")
    if not (8 <= len(prompt) <= 600) or not (2 <= len(options) <= 6):
        return None
    if len({o.lower() for o in options}) != len(options):
        return None
    if isinstance(answer, bool) or not isinstance(answer, int) or not 0 <= answer < len(options):
        return None
    difficulty = raw.get("difficulty") if raw.get("difficulty") in {"easy", "medium", "hard"} else "medium"
    return {
        "prompt": prompt,
        "options": [o[:300] for o in options],
        "answerIndex": answer,
        "explanation": str(raw.get("explanation", "")).strip()[:800],
        "topic": str(raw.get("topic") or default_topic).strip()[:60] or default_topic,
        "difficulty": difficulty,
    }


def parse_json_questions(text: str) -> list[Any]:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    data = json.loads(text)
    questions = data.get("questions", []) if isinstance(data, dict) else data
    return questions if isinstance(questions, list) else []


def build_quiz_graph(deps: Deps):
    def load(state: QuizState) -> QuizState:
        return {"index_missing": deps.cache.get(state["course_id"]) is None}

    def route_load(state: QuizState) -> str:
        return "end" if state["index_missing"] else "generate"

    async def generate(state: QuizState) -> QuizState:
        index = deps.cache.get(state["course_id"])
        scoped = [c for c in index.chunks if not state.get("lesson_id") or c["lessonId"] == state["lesson_id"]]
        if deps.llm.available and scoped:
            step = max(1, len(scoped) // 8)
            passages = "\n\n".join(f"[{c['title']}] {c['text']}" for c in scoped[::step][:8])
            user = f"Passages:\n{passages}\n\nWrite {state['count']} {state['difficulty']} questions."
            try:
                text = await deps.llm.complete(QUIZ_SYSTEM, user, json_mode=True, max_tokens=1400)
                usable = [q for q in (validate_question(r) for r in parse_json_questions(text)) if q]
                if usable:
                    return {"raw": usable, "generated_by": deps.llm.name}
            except (LLMError, ValueError, AttributeError):
                pass
        raw = generate_cloze(index, lesson_id=state.get("lesson_id"), count=state["count"], difficulty=state["difficulty"])
        return {"raw": raw, "generated_by": "offline-cloze"}

    def validate(state: QuizState) -> QuizState:
        seen: set[str] = set()
        questions: list[dict[str, Any]] = []
        for raw in state["raw"]:
            question = validate_question(raw)
            if question and question["prompt"].lower() not in seen:
                seen.add(question["prompt"].lower())
                questions.append(question)
        return {"questions": questions[: state["count"]]}

    graph = StateGraph(QuizState)
    graph.add_node("load", load)
    graph.add_node("generate", generate)
    graph.add_node("validate", validate)
    graph.add_edge(START, "load")
    graph.add_conditional_edges("load", route_load, {"end": END, "generate": "generate"})
    graph.add_edge("generate", "validate")
    graph.add_edge("validate", END)
    return graph.compile()

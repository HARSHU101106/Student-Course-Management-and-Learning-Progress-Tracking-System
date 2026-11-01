"""Tutor pipeline: guard -> retrieve -> (generate -> verify) | no_answer | refuse."""
import re
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from ..guardrails.input_guard import check_question
from ..guardrails.output_guard import keep_supported
from ..prompts import TUTOR_SYSTEM
from ..services import extractive
from ..services.container import Deps
from ..services.llm import LLMError
from ..services.retrieval import Hit, search
from ..services.text import tokens

REFUSAL = "I can only help with questions about your course material."
NOT_INDEXED = "This course has not been indexed for the tutor yet. Ask your instructor to re-index it."
NOT_FOUND = "I couldn't find that in this course's material. Try rephrasing, or ask your instructor."


class TutorState(TypedDict, total=False):
    course_id: str
    lesson_id: str | None
    question: str
    history: list[dict[str, str]]
    clean: str
    blocked: bool
    reason: str
    index_missing: bool
    hits: list[Hit]
    near: list[Hit]
    answer: str
    citations: list[dict[str, Any]]
    generated_by: str
    grounded: bool
    refused: bool
    insufficient: bool
    suggestions: list[str]


_FOLLOW_UP = re.compile(
    r"^\s*(and|also|then|so|but|what about|how about)\b|\b(it|its|that|this|they|them|those|these|one|former|latter)\b",
    re.IGNORECASE,
)


def condense(question: str, history: list[dict[str, str]]) -> str | None:
    """Rewrite a *follow-up* ('and durability?', 'what about its drawbacks?') using the last user turn.

    Returns None when the question looks self-contained or there is nothing to borrow, so a short
    but new question ('how do I bake bread?') is never silently tied to the previous topic.
    """
    if len(tokens(question, bigrams=False)) > 4 or not _FOLLOW_UP.search(question):
        return None
    previous = [turn["content"] for turn in history if turn["role"] == "user"]
    return f"{previous[-1]} {question}" if previous else None


def build_tutor_graph(deps: Deps):
    settings = deps.settings

    def guard(state: TutorState) -> TutorState:
        result = check_question(state["question"])
        return {"clean": result.question, "blocked": result.blocked, "reason": result.reason}

    def route_guard(state: TutorState) -> str:
        return "refuse" if state["blocked"] else "retrieve"

    def refuse(state: TutorState) -> TutorState:
        message = "Please ask a complete question." if state["reason"] == "empty" else REFUSAL
        return {"answer": message, "citations": [], "grounded": False, "refused": True, "generated_by": "guardrail"}

    def retrieve(state: TutorState) -> TutorState:
        index = deps.cache.get(state["course_id"])
        if index is None:
            return {"index_missing": True, "hits": [], "near": []}
        # Redaction placeholders such as [email] are noise for retrieval (but stay in the prompt).
        strip = lambda text: re.sub(r"\[[a-z-]+\]", " ", text)
        found = search(index, strip(state["clean"]), k=settings.top_k, lesson_id=state.get("lesson_id"))
        strong = [hit for hit in found if hit.score >= settings.min_retrieval_score]
        if not strong:
            # Only a self-contained miss on a follow-up-shaped question is retried with the previous turn.
            rewritten = condense(state["clean"], state.get("history", []))
            if rewritten:
                found = search(index, strip(rewritten), k=settings.top_k, lesson_id=state.get("lesson_id"))
                strong = [hit for hit in found if hit.score >= settings.min_retrieval_score]
        return {"hits": strong, "near": found[:2], "index_missing": False}

    def route_retrieve(state: TutorState) -> str:
        return "generate" if state["hits"] else "no_answer"

    def no_answer(state: TutorState) -> TutorState:
        suggestions = [] if state.get("index_missing") else list(dict.fromkeys(h.chunk["title"] for h in state.get("near", [])))
        return {
            "answer": NOT_INDEXED if state.get("index_missing") else NOT_FOUND,
            "citations": [],
            "grounded": False,
            "refused": False,
            "generated_by": "none",
            "suggestions": suggestions,
        }

    async def generate(state: TutorState) -> TutorState:
        hits = state["hits"]
        index = deps.cache.get(state["course_id"])
        if deps.llm.available:
            context = "\n\n".join(f"[{i}] ({h.chunk['title']}) {h.chunk['text']}" for i, h in enumerate(hits, 1))
            history = "\n".join(f"{t['role']}: {t['content']}" for t in state.get("history", [])[-4:])
            user = f"Context passages:\n{context}\n\nConversation so far:\n{history or '(none)'}\n\nStudent question: {state['clean']}"
            try:
                text = (await deps.llm.complete(TUTOR_SYSTEM, user, max_tokens=500)).strip()
            except LLMError:
                text = ""
            if "INSUFFICIENT_CONTEXT" in text:
                return {"insufficient": True}
            if text:
                return {"answer": text, "generated_by": deps.llm.name, "citations": [extractive.citation(h) for h in hits[:3]]}
        answer, citations = extractive.compose(state["clean"], hits, index.model)
        return {"answer": answer, "citations": citations, "generated_by": "extractive"}

    def route_generate(state: TutorState) -> str:
        return "no_answer" if state.get("insufficient") else "verify"

    def verify(state: TutorState) -> TutorState:
        if state["generated_by"] == "extractive":
            return {"grounded": True, "refused": False}
        filtered, kept, _ = keep_supported(state["answer"], [h.chunk["text"] for h in state["hits"]])
        if kept == 0:
            index = deps.cache.get(state["course_id"])
            answer, citations = extractive.compose(state["clean"], state["hits"], index.model)
            return {"answer": answer, "citations": citations, "generated_by": "extractive", "grounded": True, "refused": False}
        return {"answer": filtered, "grounded": True, "refused": False}

    graph = StateGraph(TutorState)
    graph.add_node("guard", guard)
    graph.add_node("refuse", refuse)
    graph.add_node("retrieve", retrieve)
    graph.add_node("no_answer", no_answer)
    graph.add_node("generate", generate)
    graph.add_node("verify", verify)
    graph.add_edge(START, "guard")
    graph.add_conditional_edges("guard", route_guard, {"refuse": "refuse", "retrieve": "retrieve"})
    graph.add_conditional_edges("retrieve", route_retrieve, {"generate": "generate", "no_answer": "no_answer"})
    graph.add_conditional_edges("generate", route_generate, {"verify": "verify", "no_answer": "no_answer"})
    for node in ("refuse", "no_answer", "verify"):
        graph.add_edge(node, END)
    return graph.compile()

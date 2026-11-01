"""Offline evaluation of the AdaptLearn AI pipeline against the seed catalogue.

    python -m eval.run_eval --json eval/results.json --markdown ../docs/evaluation-results.md

Everything runs without network access or API keys (offline provider), so results are reproducible.
"""
import argparse
import asyncio
import json
import re
import statistics
import time
from datetime import date
from pathlib import Path

from app.config import Settings
from app.graphs.tutor_graph import build_tutor_graph
from app.services.container import Deps
from app.services.llm import OfflineLLM
from app.services.quiz_offline import generate_cloze
from app.services.retrieval import build_index, search
from app.services.store import IndexCache, MemoryStore
from app.services.text import STOPWORDS, stem, words

HERE = Path(__file__).parent
SWEEP = [round(x * 0.01, 2) for x in range(2, 41)]


def load():
    catalog = json.loads((HERE / "catalog.json").read_text())
    rows = [json.loads(line) for line in (HERE / "dataset.jsonl").read_text().splitlines() if line.strip()]
    return catalog, rows


def pct(n, d):
    return round(100 * n / d, 1) if d else 0.0


def f1(precision, recall):
    return 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)


def confusion(scored, threshold):
    """scored: [(top_score, should_answer)] -> precision / recall / f1 of 'answering'."""
    tp = sum(1 for s, a in scored if a and s >= threshold)
    fp = sum(1 for s, a in scored if not a and s >= threshold)
    fn = sum(1 for s, a in scored if a and s < threshold)
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {"threshold": threshold, "precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1(precision, recall), 3)}


def run() -> dict:
    catalog, rows = load()
    settings = Settings(environment="test", ai_service_token="eval-token-eval-token-eval-1234", _env_file=None)
    store = MemoryStore()
    for course in catalog:
        build_index(store, course["courseId"], course["lessons"])
    cache = IndexCache(store)
    deps = Deps(settings=settings, store=store, cache=cache, llm=OfflineLLM())
    graph = build_tutor_graph(deps)
    index_of = lambda c: cache.get(catalog[c - 1]["courseId"])
    course_text = {c["courseId"]: " ".join(l["text"] for l in c["lessons"]) for c in catalog}

    answerable = [r for r in rows if r["kind"] == "answerable"]
    unanswerable = [r for r in rows if r["kind"] == "unanswerable"]
    injections = [r for r in rows if r["kind"] == "injection"]

    # ---- 1. retrieval quality (threshold-free) ---------------------------------------------------
    ranks = []
    for r in answerable:
        hits = search(index_of(r["course"]), r["question"], k=10)
        titles = []
        for hit in hits:
            if hit.chunk["title"] not in titles:
                titles.append(hit.chunk["title"])
        ranks.append(titles.index(r["expectLesson"]) + 1 if r["expectLesson"] in titles else None)
    hit1 = sum(1 for x in ranks if x == 1)
    hit3 = sum(1 for x in ranks if x and x <= 3)
    mrr = round(sum(1 / x for x in ranks if x) / len(ranks), 3)

    # ---- 2. answer / abstain threshold, selected on a dev split and reported on a held-out split ----
    def top_score(r):
        hits = search(index_of(r["course"]), r["question"], k=1)
        return hits[0].score if hits else 0.0

    scored = [(top_score(r), r["kind"] == "answerable", i) for i, r in enumerate(answerable + unanswerable)]
    dev = [(s, a) for s, a, i in scored if i % 2 == 0]
    test = [(s, a) for s, a, i in scored if i % 2 == 1]
    answer_scores = sorted(s for s, a, _ in scored if a)
    scope_scores = sorted((s for s, a, _ in scored if not a), reverse=True)
    sweep_dev = [confusion(dev, t) for t in SWEEP]
    best_f1 = max(row["f1"] for row in sweep_dev)
    chosen = max(row["threshold"] for row in sweep_dev if row["f1"] == best_f1)  # most conservative among ties
    split = {
        "chosenOnDev": chosen,
        "dev": confusion(dev, chosen),
        "heldOutTest": confusion(test, chosen),
        "configured": settings.min_retrieval_score,
        "configuredAll": confusion([(s, a) for s, a, _ in scored], settings.min_retrieval_score),
        "lowestAnswerableScore": round(answer_scores[0], 3),
        "highestOutOfScopeScore": round(scope_scores[0], 3),
        "devItems": len(dev),
        "testItems": len(test),
    }

    # ---- 3. end-to-end tutor behaviour at the configured threshold ----------------------------------
    latencies, correct, grounded_ok, sentences_total, sentences_supported = [], 0, 0, 0, 0
    wrong = []
    for r in answerable:
        cid = catalog[r["course"] - 1]["courseId"]
        started = time.perf_counter()
        state = asyncio.run(graph.ainvoke({"course_id": cid, "question": r["question"], "history": []}))
        latencies.append((time.perf_counter() - started) * 1000)
        cited = [c["title"] for c in state.get("citations", [])]
        if state.get("grounded") and r["expectLesson"] in cited:
            correct += 1
        else:
            wrong.append({"id": r["id"], "question": r["question"], "expected": r["expectLesson"], "grounded": state.get("grounded"), "cited": cited})
        if state.get("grounded"):
            grounded_ok += 1
            for sentence in re.split(r"(?<=[.!?])\s+", re.sub(r"\s*\[\d+\]", "", state["answer"])):
                if sentence.strip():
                    sentences_total += 1
                    sentences_supported += sentence.strip() in course_text[cid]
    abstained = 0
    false_answers = []
    for r in unanswerable:
        cid = catalog[r["course"] - 1]["courseId"]
        state = asyncio.run(graph.ainvoke({"course_id": cid, "question": r["question"], "history": []}))
        if not state.get("grounded"):
            abstained += 1
        else:
            false_answers.append({"id": r["id"], "question": r["question"], "cited": [c["title"] for c in state["citations"]]})
    blocked = 0
    for r in injections:
        cid = catalog[r["course"] - 1]["courseId"]
        state = asyncio.run(graph.ainvoke({"course_id": cid, "question": r["question"], "history": []}))
        blocked += bool(state.get("refused"))

    # ---- 4. offline quiz generation quality ---------------------------------------------------------
    total_q = valid = answer_in_source = lessons_without = 0
    for course in catalog:
        index = cache.get(course["courseId"])
        for lesson in course["lessons"]:
            qs = generate_cloze(index, lesson_id=lesson["id"], count=3, difficulty="medium")
            lessons_without += not qs
            for q in qs:
                total_q += 1
                options_ok = 2 <= len(q["options"]) <= 6 and len({o.lower() for o in q["options"]}) == len(q["options"])
                index_ok = 0 <= q["answerIndex"] < len(q["options"])
                valid += options_ok and index_ok
                correct_option = q["options"][q["answerIndex"]].lower()
                answer_in_source += correct_option in lesson["text"].lower() and q["explanation"] in lesson["text"]
    n_lessons = sum(len(c["lessons"]) for c in catalog)

    return {
        "generatedOn": date.today().isoformat(),
        "dataset": {"courses": len(catalog), "lessons": n_lessons, "answerable": len(answerable), "unanswerable": len(unanswerable), "injection": len(injections)},
        "retrieval": {"hit@1": pct(hit1, len(answerable)), "hit@3": pct(hit3, len(answerable)), "mrr": mrr},
        "threshold": split,
        "tutor": {
            "answeredCorrectly": pct(correct, len(answerable)),
            "abstainedOnUnanswerable": pct(abstained, len(unanswerable)),
            "injectionBlocked": pct(blocked, len(injections)),
            "faithfulSentences": pct(sentences_supported, sentences_total),
            "latencyMsP50": round(statistics.median(latencies), 1),
            "latencyMsP95": round(sorted(latencies)[int(0.95 * (len(latencies) - 1))], 1),
            "missedAnswerable": wrong,
            "falseAnswers": false_answers,
        },
        "quiz": {
            "questionsGenerated": total_q,
            "structurallyValid": pct(valid, total_q),
            "answerTraceableToSource": pct(answer_in_source, total_q),
            "lessonsWithNoQuestion": lessons_without,
            "lessons": n_lessons,
        },
    }


def markdown(r: dict) -> str:
    t, tu, q, d = r["threshold"], r["tutor"], r["quiz"], r["dataset"]
    lines = [
        "# AI Evaluation Results",
        "",
        f"_Generated by `python -m eval.run_eval` on {r['generatedOn']}. Provider: **offline** (no LLM, no network). Reproducible: same code + dataset give the same numbers._",
        "",
        f"**Data:** {d['courses']} courses, {d['lessons']} lessons (the seed catalogue); {d['answerable']} answerable questions, "
        f"{d['unanswerable']} out-of-scope questions, {d['injection']} prompt-injection attempts (`ai-service/eval/dataset.jsonl`).",
        "",
        "## Retrieval (does the tutor find the right lesson?)",
        "",
        "| Metric | Result |",
        "|---|---|",
        f"| Hit@1 (correct lesson ranked first) | {r['retrieval']['hit@1']}% |",
        f"| Hit@3 (correct lesson in top 3) | {r['retrieval']['hit@3']}% |",
        f"| Mean reciprocal rank | {r['retrieval']['mrr']} |",
        "",
        "## Answer / abstain threshold",
        "",
        f"The minimum retrieval score below which the tutor says \"not in the course material\" was selected on a **dev split** ({t['devItems']} items) "
        f"by best F1 (most conservative value among ties) and then measured on a **held-out split** ({t['testItems']} items):",
        "",
        "| Split | Threshold | Precision | Recall | F1 |",
        "|---|---|---|---|---|",
        f"| Dev | {t['chosenOnDev']} | {t['dev']['precision']} | {t['dev']['recall']} | {t['dev']['f1']} |",
        f"| Held-out | {t['chosenOnDev']} | {t['heldOutTest']['precision']} | {t['heldOutTest']['recall']} | {t['heldOutTest']['f1']} |",
        f"| All items at the configured default ({t['configured']}) | {t['configured']} | {t['configuredAll']['precision']} | {t['configuredAll']['recall']} | {t['configuredAll']['f1']} |",
        "",
        f"**Score overlap.** The lowest-scoring in-scope question scores {t['lowestAnswerableScore']} and the highest-scoring out-of-scope question scores "
        f"{t['highestOutOfScopeScore']}. " + (
            "These ranges overlap, so no single threshold separates the classes perfectly (lexical retrieval cannot tell \"control\" in networking from \"control\" in concurrency control). "
            f"The shipped default ({t['configured']}) is deliberately set above the highest out-of-scope score: it prefers declining a borderline question (the tutor still lists the closest lessons) over giving a wrong answer. "
            "The small held-out split is fragile; do not read its 1.0 as a guarantee."
            if t['lowestAnswerableScore'] < t['highestOutOfScopeScore'] else
            "The ranges do not overlap on this set."),
        "",
        "## End-to-end tutor behaviour (configured threshold)",
        "",
        "| Behaviour | Result |",
        "|---|---|",
        f"| Answerable questions answered with the expected lesson cited | {tu['answeredCorrectly']}% |",
        f"| Out-of-scope questions correctly declined (no invented answer) | {tu['abstainedOnUnanswerable']}% |",
        f"| Prompt-injection attempts refused | {tu['injectionBlocked']}% |",
        f"| Answer sentences that appear verbatim in the course material | {tu['faithfulSentences']}% |",
        f"| Latency per question, p50 / p95 (in-process, offline provider) | {tu['latencyMsP50']} ms / {tu['latencyMsP95']} ms |",
        "",
    ]
    if tu["missedAnswerable"]:
        lines += ["**Answerable questions the tutor missed:**", ""]
        lines += [f"- `{m['id']}` \"{m['question']}\" (expected *{m['expected']}*; grounded={m['grounded']}, cited={m['cited']})" for m in tu["missedAnswerable"]]
        lines.append("")
    if tu["falseAnswers"]:
        lines += ["**Out-of-scope questions wrongly answered:**", ""]
        lines += [f"- `{m['id']}` \"{m['question']}\" (cited {m['cited']})" for m in tu["falseAnswers"]]
        lines.append("")
    lines += [
        "## Offline quiz generation (draft quality)",
        "",
        "| Metric | Result |",
        "|---|---|",
        f"| Questions generated (3 requested per lesson) | {q['questionsGenerated']} across {q['lessons']} lessons |",
        f"| Structurally valid (2-6 distinct options, valid answer index) | {q['structurallyValid']}% |",
        f"| Correct option and explanation traceable to the lesson text | {q['answerTraceableToSource']}% |",
        f"| Lessons that produced no question | {q['lessonsWithNoQuestion']} of {q['lessons']} |",
        "",
        "## How to read these numbers",
        "",
        "- The question set is small and written by the project author against the same notes the index is built from, so treat the figures as a **regression baseline and sanity check**, not as a benchmark of real-world performance. Real student questions are noisier.",
        "- Faithfulness is high by construction in offline mode (answers are extracted sentences). With a hosted LLM, the output guard removes sentences that are not lexically supported by the retrieved passages, but fluent paraphrase can still be wrong; keep human review on AI-generated quizzes (they are saved as drafts).",
        "- Offline quiz questions are cloze-style (one key term blanked). They are valid and traceable but pedagogically simple; a hosted model produces richer questions.",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--json")
    parser.add_argument("--markdown")
    args = parser.parse_args()
    result = run()
    if args.json:
        Path(args.json).write_text(json.dumps(result, indent=2) + "\n")
    if args.markdown:
        Path(args.markdown).parent.mkdir(parents=True, exist_ok=True)
        Path(args.markdown).write_text(markdown(result))
    print(markdown(result))

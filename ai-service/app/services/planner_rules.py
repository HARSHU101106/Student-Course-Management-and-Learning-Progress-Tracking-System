"""Rule-based study planner. Transparent and reproducible; an LLM may only rephrase the summary."""
from datetime import datetime, timezone
from typing import Any

WEAK_BELOW = 0.6
MAX_REVISIT = 3
MAX_PRACTICE = 2
MAX_ADVANCE = 3
MINUTES = {"revisit": 25, "practice": 15, "advance": 30}


def _days_since(value: Any) -> float:
    if not value:
        return 0.0
    try:
        stamp = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - stamp).total_seconds() / 86400)


def build_plan(
    lessons: list[dict[str, Any]],
    completed_ids: list[str],
    mastery: list[dict[str, Any]],
    weekly_hours: int,
) -> dict[str, Any]:
    ordered = sorted(lessons, key=lambda lesson: lesson.get("order", 0))
    done = set(completed_ids)
    by_topic: dict[str, dict[str, Any]] = {m["topic"].lower(): m for m in mastery}

    def lessons_for(topic: str) -> list[dict[str, Any]]:
        return [lesson for lesson in ordered if topic.lower() in [t.lower() for t in lesson.get("topics", [])]]

    items: list[dict[str, Any]] = []

    # 1) Revisit weak topics, most urgent first (low score, longer since last assessed).
    weak = [m for m in mastery if m["attempts"] >= 1 and m["score"] < WEAK_BELOW]
    weak.sort(key=lambda m: -((1 - m["score"]) * (1 + min(_days_since(m.get("lastAssessedAt")), 14) / 14)))
    for m in weak[:MAX_REVISIT]:
        candidates = lessons_for(m["topic"])
        target = next((l for l in candidates if l["id"] in done), candidates[0] if candidates else None)
        items.append(
            {
                "type": "revisit",
                "title": f"Revisit: {target['title']}" if target else f"Revisit {m['topic']}",
                "topic": m["topic"],
                "lessonId": target["id"] if target else None,
                "reason": f"Mastery of {m['topic']} is {round(m['score'] * 100)}% after {m['attempts']} answered question(s).",
                "minutes": MINUTES["revisit"],
            }
        )

    # 2) Assess topics that were studied but never quizzed.
    practiced = 0
    seen_topics: set[str] = {i["topic"].lower() for i in items if i.get("topic")}
    for lesson in ordered:
        if practiced >= MAX_PRACTICE:
            break
        if lesson["id"] not in done:
            continue
        for topic in lesson.get("topics", []):
            key = topic.lower()
            if key in seen_topics or (key in by_topic and by_topic[key]["attempts"] > 0):
                continue
            seen_topics.add(key)
            items.append(
                {
                    "type": "practice",
                    "title": f"Check your understanding of {topic}",
                    "topic": topic,
                    "lessonId": lesson["id"],
                    "reason": "You completed this lesson but have not been assessed on the topic yet.",
                    "minutes": MINUTES["practice"],
                }
            )
            practiced += 1
            break

    # 3) Move forward through the next unfinished lessons.
    upcoming = [lesson for lesson in ordered if lesson["id"] not in done][:MAX_ADVANCE]
    for position, lesson in enumerate(upcoming):
        items.append(
            {
                "type": "advance",
                "title": f"Watch: {lesson['title']}",
                "topic": (lesson.get("topics") or [None])[0],
                "lessonId": lesson["id"],
                "reason": "Next lesson in the course." if position == 0 else "Keep your momentum going.",
                "minutes": MINUTES["advance"],
            }
        )

    # Fit the student's weekly time budget but always keep the single most important item.
    budget = max(weekly_hours, 1) * 60
    fitted: list[dict[str, Any]] = []
    spent = 0
    for item in items:
        if fitted and spent + item["minutes"] > budget:
            continue
        fitted.append(item)
        spent += item["minutes"]

    next_lesson = upcoming[0] if upcoming else None
    return {
        "items": fitted,
        "facts": {
            "weakest": weak[0]["topic"] if weak else None,
            "weakestScore": round(weak[0]["score"] * 100) if weak else None,
            "nextLesson": next_lesson["title"] if next_lesson else None,
            "minutes": spent,
            "weeklyHours": weekly_hours,
            "complete": not upcoming,
        },
    }


def summarise(facts: dict[str, Any]) -> str:
    if facts["complete"] and not facts["weakest"]:
        return "You have completed every lesson with no weak topics. Consider retaking quizzes to keep the material fresh."
    parts = [f"This plan takes about {facts['minutes']} minutes of your {facts['weeklyHours']} hours this week."]
    if facts["weakest"]:
        parts.append(f"Start with {facts['weakest']} (currently {facts['weakestScore']}%)")
        parts[-1] += f", then continue with {facts['nextLesson']}." if facts["nextLesson"] else "."
    elif facts["nextLesson"]:
        parts.append(f"Continue with {facts['nextLesson']}.")
    return " ".join(parts)

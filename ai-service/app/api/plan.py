from fastapi import APIRouter

from app.schemas.models import PlanItem, PlanRequest

router = APIRouter()


@router.post("/")
def build_plan(payload: PlanRequest | dict | None = None):
    if payload is None:
        payload = {}
    if isinstance(payload, dict):
        payload = PlanRequest(**payload)

    goals = payload.goals or []
    plan = [
        PlanItem(
            type="Revisit",
            title="Normalization",
            reason=f"You have {len(goals) or 1} learning signals that suggest a quick review before the next lesson.",
            time="45 min",
            accent="coral",
        ),
        PlanItem(
            type="Practice",
            title="Relational algebra",
            reason="Practice joins and filtering to reinforce the core query patterns from the lecture.",
            time="30 min",
            accent="amber",
        ),
        PlanItem(
            type="Advance",
            title="Transactions and ACID",
            reason="You are ready for the next concept once the review and practice blocks are complete.",
            time="60 min",
            accent="cyan",
        ),
    ]
    return {"courseId": payload.course_id or "dbms-101", "items": [item.model_dump() for item in plan]}

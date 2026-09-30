from fastapi import APIRouter

router = APIRouter()

@router.post("/")
def build_plan(payload: dict | None = None):
    payload = payload or {}
    goals = payload.get("goals", [])
    return {
        "plan": [
            {"type": "Revisit", "title": "Normalization", "reason": f"Recommended after {len(goals) or 1} signals."},
            {"type": "Practice", "title": "Relational algebra", "reason": "Practice joins and filters."},
        ]
    }

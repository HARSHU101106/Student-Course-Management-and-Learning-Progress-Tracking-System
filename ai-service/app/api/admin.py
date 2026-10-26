from fastapi import APIRouter

from app.schemas.models import StudioImportRequest

router = APIRouter()


@router.get("/health")
def admin_health():
    return {"status": "ok"}


@router.get("/students")
def list_students():
    return {"items": [{"id": "stu-1", "name": "Ravi K.", "mastery": 31}]}


@router.post("/report")
def generate_report(payload: dict | None = None):
    payload = payload or {}
    return {
        "report": {
            "courseId": payload.get("courseId") or "dbms-101",
            "atRisk": [],
            "summary": "No major risk flagged for the current period.",
        }
    }


@router.post("/import")
def import_playlist(payload: StudioImportRequest | dict | None = None):
    if payload is None:
        payload = {}
    if isinstance(payload, dict):
        payload = StudioImportRequest(**payload)
    return {"status": "queued", "url": payload.url}

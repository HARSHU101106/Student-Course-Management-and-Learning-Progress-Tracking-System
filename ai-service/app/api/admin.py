from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def admin_health():
    return {"status": "ok"}

@router.get("/students")
def list_students():
    return {"items": [{"id": "stu-1", "name": "Ravi K.", "mastery": 31}]}

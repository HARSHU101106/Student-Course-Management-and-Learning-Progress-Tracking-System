from fastapi import APIRouter

router = APIRouter()

@router.post("/import")
def import_playlist(payload: dict | None = None):
    payload = payload or {}
    url = payload.get("url")
    if not url:
        return {"error": "A YouTube playlist URL is required."}
    return {"status": "queued", "url": url}

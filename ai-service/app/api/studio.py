from fastapi import APIRouter

from app.schemas.models import StudioImportRequest

router = APIRouter()


@router.post("/import")
def import_playlist(payload: StudioImportRequest | dict | None = None):
    if payload is None:
        payload = {}
    if isinstance(payload, dict):
        payload = StudioImportRequest(**payload)
    return {
        "status": "queued",
        "url": payload.url,
        "modules": [{"title": "Imported module", "items": []}],
    }

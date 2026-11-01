import asyncio

from fastapi import APIRouter, Path, Request

from ..schemas.models import IngestRequest, IngestResponse
from ..services.retrieval import build_index

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])


@router.post("", response_model=IngestResponse)
async def ingest(body: IngestRequest, request: Request) -> IngestResponse:
    deps = request.app.state.deps
    lessons = [lesson.model_dump() for lesson in body.lessons]
    lesson_count, chunk_count = await asyncio.to_thread(build_index, deps.store, body.courseId, lessons)
    deps.cache.invalidate(body.courseId)
    return IngestResponse(courseId=body.courseId, lessons=lesson_count, chunks=chunk_count)


@router.delete("/{course_id}")
async def remove(request: Request, course_id: str = Path(pattern=r"^[A-Za-z0-9_-]{1,40}$")) -> dict:
    deps = request.app.state.deps
    removed = await asyncio.to_thread(deps.store.delete_course, course_id)
    deps.cache.invalidate(course_id)
    return {"courseId": course_id, "removedChunks": removed}

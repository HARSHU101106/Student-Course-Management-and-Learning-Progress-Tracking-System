from fastapi import APIRouter, Request

from ..schemas.models import Citation, TutorRequest, TutorResponse

router = APIRouter(prefix="/v1/tutor", tags=["tutor"])


@router.post("/answer", response_model=TutorResponse)
async def answer(body: TutorRequest, request: Request) -> TutorResponse:
    state = await request.app.state.graphs["tutor"].ainvoke(
        {
            "course_id": body.courseId,
            "lesson_id": body.lessonId,
            "question": body.question,
            "history": [turn.model_dump() for turn in body.history],
        }
    )
    return TutorResponse(
        answer=state["answer"],
        citations=[Citation(**c) for c in state.get("citations", [])],
        grounded=state.get("grounded", False),
        refused=state.get("refused", False),
        generatedBy=state.get("generated_by", "none"),
        suggestions=state.get("suggestions", []),
    )

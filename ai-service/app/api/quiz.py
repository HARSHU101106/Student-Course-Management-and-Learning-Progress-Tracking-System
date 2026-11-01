from fastapi import APIRouter, HTTPException, Request

from ..schemas.models import QuizQuestion, QuizRequest, QuizResponse

router = APIRouter(prefix="/v1/quiz", tags=["quiz"])


@router.post("/generate", response_model=QuizResponse)
async def generate(body: QuizRequest, request: Request) -> QuizResponse:
    state = await request.app.state.graphs["quiz"].ainvoke(
        {"course_id": body.courseId, "lesson_id": body.lessonId, "count": body.count, "difficulty": body.difficulty}
    )
    if state.get("index_missing"):
        raise HTTPException(404, "This course has not been indexed yet. Re-index it, then try again.")
    return QuizResponse(
        questions=[QuizQuestion(**q) for q in state["questions"]],
        generatedBy=state["generated_by"],
    )

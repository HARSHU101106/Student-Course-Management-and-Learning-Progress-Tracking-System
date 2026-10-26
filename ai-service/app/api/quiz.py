from fastapi import APIRouter

from app.schemas.models import QuizGenerationRequest, QuizQuestion

router = APIRouter()


@router.get("/demo")
def demo_quiz():
    return {
        "items": [
            {"id": 1, "prompt": "What does 3NF remove?", "options": ["Partial dependencies", "Transitive dependencies"], "answer": "Transitive dependencies"}
        ]
    }


@router.post("/generate")
def generate_quiz(payload: QuizGenerationRequest | dict | None = None):
    if payload is None:
        payload = {}
    if isinstance(payload, dict):
        payload = QuizGenerationRequest(**payload)

    question = QuizQuestion(
        id=1,
        prompt=f"Which topic best matches {payload.lesson_id or payload.course_id or 'this lesson'}?",
        options=["Normalization", "Sorting", "Networking", "Rendering"],
        answer="Normalization",
    )

    return {"questions": [question.model_dump()]}

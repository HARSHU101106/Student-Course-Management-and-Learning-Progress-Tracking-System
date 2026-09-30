from fastapi import APIRouter

router = APIRouter()

@router.get("/demo")
def demo_quiz():
    return {
        "items": [
            {"id": 1, "prompt": "What does 3NF remove?", "options": ["Partial dependencies", "Transitive dependencies"], "answer": "Transitive dependencies"}
        ]
    }

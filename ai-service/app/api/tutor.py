from fastapi import APIRouter

router = APIRouter()

@router.post("/answer")
def answer_question(payload: dict | None = None):
    payload = payload or {}
    question = payload.get("question", "")
    if "2nf" in question.lower():
        return {"answer": "2NF removes partial dependencies. 3NF also removes transitive dependencies."}
    return {"answer": "That concept is covered in the course material. Try asking about normalization or joins."}

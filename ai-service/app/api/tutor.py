from fastapi import APIRouter

from app.schemas.models import TutorAnswer, TutorRequest

router = APIRouter()


@router.post("/answer")
def answer_question(payload: TutorRequest | dict | None = None):
    if payload is None:
        payload = {}
    if isinstance(payload, dict):
        payload = TutorRequest(**payload)

    query = payload.question.lower()
    if "2nf" in query:
        answer = "2NF removes partial dependencies. 3NF also removes transitive dependencies."
        citations = [{"lesson": "Database Design and Normalization", "timestamp": 570}]
    elif "normal" in query or "join" in query:
        answer = "Normalization organizes data to reduce redundancy and protect integrity, while joins combine rows from related tables."
        citations = [{"lesson": "SQL Joins and Relational Design", "timestamp": 430}]
    else:
        answer = "That concept is covered in the course material. Try asking about normalization, joins, transactions, or indexing."
        citations = [{"lesson": "Lecture overview", "timestamp": 0}]

    return TutorAnswer(answer=answer, citations=citations).model_dump()

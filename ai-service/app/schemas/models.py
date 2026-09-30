from pydantic import BaseModel

class TutorRequest(BaseModel):
    question: str

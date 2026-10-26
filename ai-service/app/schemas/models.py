from pydantic import BaseModel, Field


class TutorRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    lesson_id: str | None = None
    timestamp: int = 0


class PlanItem(BaseModel):
    type: str
    title: str
    reason: str
    time: str | None = None
    accent: str | None = None


class PlanRequest(BaseModel):
    goals: list[str] = Field(default_factory=list)
    course_id: str | None = None
    weekly_hours: int = 3


class QuizQuestion(BaseModel):
    id: int
    prompt: str
    options: list[str]
    answer: str


class QuizGenerationRequest(BaseModel):
    lesson_id: str | None = None
    course_id: str | None = None


class StudioImportRequest(BaseModel):
    url: str = Field(..., min_length=1)


class TutorAnswer(BaseModel):
    answer: str
    citations: list[dict[str, str | int]] = Field(default_factory=list)

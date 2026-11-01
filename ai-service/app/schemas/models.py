"""Request/response contracts shared with the Express API (see docs/api-spec.md)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Id = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")


class LessonIn(BaseModel):
    id: str = Id
    title: str = Field(max_length=200)
    order: int = 0
    topics: list[str] = Field(default_factory=list, max_length=12)
    videoId: str = Field(default="", max_length=20)
    text: str = Field(default="", max_length=40000)


class IngestRequest(BaseModel):
    courseId: str = Id
    lessons: list[LessonIn] = Field(max_length=500)


class IngestResponse(BaseModel):
    courseId: str
    lessons: int
    chunks: int


class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1500)


class TutorRequest(BaseModel):
    courseId: str = Id
    lessonId: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,40}$")
    question: str = Field(min_length=1, max_length=600)
    history: list[HistoryItem] = Field(default_factory=list, max_length=6)


class Citation(BaseModel):
    lessonId: str
    title: str
    order: int = 0
    snippet: str
    score: float = 0.0


class TutorResponse(BaseModel):
    answer: str
    citations: list[Citation]
    grounded: bool
    refused: bool
    generatedBy: str
    suggestions: list[str] = Field(default_factory=list)


class QuizRequest(BaseModel):
    courseId: str = Id
    lessonId: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,40}$")
    count: int = Field(default=5, ge=1, le=10)
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class QuizQuestion(BaseModel):
    prompt: str
    options: list[str]
    answerIndex: int
    explanation: str = ""
    topic: str = "General"
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]
    generatedBy: str


class PlanLesson(BaseModel):
    id: str = Id
    title: str = Field(max_length=200)
    order: int = 0
    topics: list[str] = Field(default_factory=list, max_length=12)


class MasteryIn(BaseModel):
    topic: str = Field(max_length=60)
    score: float = Field(ge=0, le=1)
    attempts: int = Field(default=0, ge=0)
    lastAssessedAt: datetime | None = None


class PlanRequest(BaseModel):
    courseId: str = Id
    courseTitle: str = Field(default="", max_length=200)
    weeklyHours: int = Field(default=6, ge=1, le=80)
    lessons: list[PlanLesson] = Field(max_length=500)
    completedLessonIds: list[str] = Field(default_factory=list, max_length=500)
    mastery: list[MasteryIn] = Field(default_factory=list, max_length=200)


class PlanItem(BaseModel):
    type: Literal["revisit", "practice", "advance"]
    title: str
    topic: str | None = None
    lessonId: str | None = None
    reason: str = ""
    minutes: int = 0


class PlanResponse(BaseModel):
    items: list[PlanItem]
    summary: str
    generatedBy: Literal["rules", "llm"]


class OutlineItem(BaseModel):
    id: str = Id
    title: str = Field(max_length=300)
    description: str = Field(default="", max_length=2000)


class OutlineRequest(BaseModel):
    title: str = Field(max_length=200)
    items: list[OutlineItem] = Field(min_length=1, max_length=300)


class OutlineLesson(BaseModel):
    id: str
    module: str
    topics: list[str]


class OutlineModule(BaseModel):
    name: str
    lessonIds: list[str]


class OutlineResponse(BaseModel):
    lessons: list[OutlineLesson]
    modules: list[OutlineModule]

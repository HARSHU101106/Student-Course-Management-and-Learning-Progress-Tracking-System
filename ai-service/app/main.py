from fastapi import FastAPI

from app.api import admin, health, plan, quiz, studio, tutor

app = FastAPI(title="AdaptLearn AI Service")

app.include_router(health.router, tags=["health"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(plan.router, prefix="/api/plan", tags=["plan"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(studio.router, prefix="/api/studio", tags=["studio"])
app.include_router(tutor.router, prefix="/api/tutor", tags=["tutor"])

@app.get("/health")
def health_check():
    return {"status": "ok"}

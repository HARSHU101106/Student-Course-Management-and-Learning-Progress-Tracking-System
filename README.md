# AdaptLearn

Adaptive learning platform workspace containing the static frontend, React client, Express API server, and FastAPI AI service.

This is a student course management and learning progress tracking system built with HTML, CSS, JavaScript, React, Node.js, Express, MongoDB, JWT, bcrypt, and Socket.IO. The workspace also includes the AI service, API collection, and deployment configuration.

## Workspace layout

- `frontend-static/`: Tasks 2-5 static HTML/CSS/JS deliverable
- `client/`: React/Vite client for Tasks 6-7+
- `server/`: Express API and Socket.IO services
- `ai-service/`: FastAPI and LangGraph AI service
- `docs/`: Architecture, API, data model, and evaluation notes

## Tasks 8-10 status

- Task 8: data model scaffolding is in place for users, courses, lessons, progress, quizzes, and topic mastery with the relevant relational fields and indexing guidance documented in `docs/api-spec.md`.
- Task 9: the Express API includes JWT-style auth guards, protected course/student/lesson/progress/quiz endpoints, and the documented REST routes expected by the project plan.
- Task 10: the AI service exposes structured planner, tutor, quiz, and studio request models with an explicit LangGraph-style planner flow and guardrails-oriented schema validation.

See `PROJECT_PLAN.md` for the implementation sequence.

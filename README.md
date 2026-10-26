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
- Task 9: student registration and login validate inputs, hash passwords with bcrypt, reject duplicate emails, and expose the course CRUD API at `/api/v1/courses`.
- Task 10: successful login issues an expiring JWT; middleware verifies it on course create/update/delete while course listing and detail reads remain public. The Axios client attaches and clears the session token.
- AI-service scaffolding: structured planner, tutor, quiz, and studio request models are in place, along with an explicit LangGraph-style planner flow.

See `PROJECT_PLAN.md` for the implementation sequence.

### Run the API with authentication enabled

1. Copy `server/.env.example` to `server/.env`.
2. Set `JWT_SECRET` to a unique random value (at least 32 random bytes); do not commit it.
3. From `server/`, run `npm run dev`. From `client/`, run `npm run dev`.

Student accounts and course changes are currently kept in memory and reset when the API process restarts.
The React client uses the real API by default; set `VITE_API_MOCKING=enabled` to opt into the development-only MSW mock service.

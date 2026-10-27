# AdaptLearn

Adaptive learning platform workspace containing the static frontend, React client, Express API server, and FastAPI AI service.

This is a student course management and learning progress tracking system built with HTML, CSS, JavaScript, React, Node.js, Express, JWT, bcrypt, and Socket.IO. MongoDB is part of the planned deployment stack; the current learning-stage API uses in-memory stores. The workspace also includes the AI service, API collection, and deployment configuration.

## Workspace layout

- `frontend-static/`: Tasks 2-5 static HTML/CSS/JS deliverable
- `client/`: React/Vite client for Tasks 6-7+
- `server/`: Express API and Socket.IO services
- `ai-service/`: FastAPI and LangGraph AI service
- `docs/`: Architecture, API, data model, and evaluation notes

## Tasks 8-13 status

- Task 8: the planned data model and index guidance are documented in `docs/api-spec.md`; database-backed model persistence remains a deployment follow-up.
- Task 9: student registration and login validate inputs, hash passwords with bcrypt, reject duplicate emails, and expose the course CRUD API at `/api/v1/courses`.
- Task 10: successful login issues an expiring JWT; middleware verifies it on protected routes while course listing and detail reads remain public. The Axios client attaches and clears the session token.
- Task 11: student registration assigns the student role; an admin can be provisioned from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; course create/update/delete require an admin JWT.
- Task 12: students can enroll, view their own enrollments, and unenroll through authenticated, student-only routes.
- Task 13: students can update and view lesson progress for enrolled courses; invalid counts are rejected and 100% progress completes the enrollment.
- AI-service scaffolding: structured planner, tutor, quiz, and studio request models are in place, along with an explicit LangGraph-style planner flow.

See `PROJECT_PLAN.md` for implementation status and the current persistence limitation.

### Run the API with authentication enabled

1. Copy `server/.env.example` to `server/.env`.
2. Set `JWT_SECRET` to a unique random value (at least 32 random bytes); do not commit it.
3. From `server/`, run `npm run dev`. From `client/`, run `npm run dev`.

Student/admin accounts, courses, enrollments, and learning progress are currently kept in memory and reset when the API process restarts. Configure both `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env` to seed the admin account when the server starts. Public registration cannot create admin accounts.

The React client uses the real API by default; set `VITE_API_MOCKING=enabled` to opt into the development-only MSW mock API, which supports the same course, enrollment, and progress flows.

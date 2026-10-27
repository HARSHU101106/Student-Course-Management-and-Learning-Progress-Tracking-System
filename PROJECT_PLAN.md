# AdaptLearn Project Plan

## Completed implementation

1. Built the static HTML/CSS/JS experience in `frontend-static/`.
2. Added the React application, authentication, course browsing and management, lessons, enrollment, learning progress, quizzes, notifications, and AI learning tools.
3. Retained the static frontend while adding the React/Vite client.
4. Added the Express API, JWT authentication, student/admin authorization, enrollment and progress routes, and Socket.IO events.
5. Added the FastAPI AI service and evaluation suite.
6. Completed Tasks 9–13: registration/login and JWT protection; admin-only course management; student enrollment and unenrollment; progress updates, completion status, and student progress summaries.
7. Added a development-only MSW API with matching course, enrollment, and progress flows.

## Persistence limitation

The current learning-stage API stores accounts, courses, enrollments, and progress in memory. Those records reset when the server restarts. The models/database layer must be connected to durable storage before deployment.

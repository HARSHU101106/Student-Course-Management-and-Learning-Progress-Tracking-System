# API Specification

The Express server exposes `/api/auth`, `/api/students`, `/api/courses`, `/api/lessons`, `/api/enrollments`, `/api/progress`, `/api/quizzes`, `/api/ai`, and `/api/notifications`.

## Data model highlights

- `users`: `name`, `email`, `passwordHash`, `role`, `department`, `weeklyHours`
- `courses`: `title`, `description`, `category`, `instructor`, `status`, `source`
- `modules`: course/module grouping for lessons
- `lessons`: `courseId`, `moduleId`, `youtubeId`, `topics`, `durationSec`, `order`
- `enrollments`: `studentId`, `courseId`, `status`, `enrolledAt`
- `progress`: `studentId`, `courseId`, `completedLessons`, `percentComplete`
- `watch_events`: batched lesson watch events with timestamps and position data
- `quiz_attempts` and `topic_mastery`: per-course mastery and assessment signals
- `study_plans`, `notifications`, `chat_messages`, and `content_chunks`

Recommended indexes:

- `users.email` unique
- `enrollments(studentId, courseId)` unique
- `progress(studentId, courseId)` unique
- `topic_mastery(studentId, courseId, topic)` unique
- vector search on `content_chunks.embedding` filtered by `courseId`

## Auth and authorization

All routes except `/api/auth/*`, `/api/health`, and `/` are protected by JWT middleware. The demo middleware accepts a bearer token and stores a `request.user` object with an `id`, `email`, and `role`.

## Core routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/students`
- `GET /api/students/:id`
- `GET /api/courses`
- `GET /api/courses/:id`
- `GET /api/courses/:id/lessons`
- `POST /api/enrollments`
- `GET /api/enrollments/me`
- `POST /api/progress/watch`
- `POST /api/progress/lessons/:id/complete`
- `GET /api/progress/me`
- `GET /api/lessons/:id/quiz`
- `POST /api/quizzes/:quizId/attempts`
- `GET /api/ai/plan/:courseId`
- `POST /api/ai/plan/:courseId/regenerate`
- `POST /api/ai/tutor`
- `POST /api/ai/quiz/generate`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`

## AI design summary

The AI layer keeps deterministic logic in the backend while using the LLM for explanation and drafting. The planner graph follows the sequence:

- `load_signals` -> `compute_mastery` -> `select_items` -> `explain_plan` -> `validate_schema`

The mastery calculation uses performance signals (quiz score, lesson completion, and retry penalty) and converts them into a topic score in the 0-1 range. Guardrails enforce minimal input sizes, role-safe admin-only actions, and refusal rules when retrieved material does not support the answer.

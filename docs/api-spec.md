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

## Task 9 and 10 authentication and course API

Authentication and course routes are available under `/api/v1` as specified in the task PDF. The existing `/api/auth` and `/api/courses` aliases remain available for the current React client and other project consumers.

- `POST /api/v1/auth/register`: validates name, email, password, and department; stores a bcrypt password hash; returns a safe student object. Duplicate email returns `409`.
- `POST /api/v1/auth/login`: compares the submitted password with its hash and returns a signed JWT, `tokenType`, `expiresIn`, and safe student object. Invalid credentials return `401`.
- `GET /api/v1/courses` and `GET /api/v1/courses/:id`: public course browsing.
- `POST /api/v1/courses`, `PUT /api/v1/courses/:id`, and `DELETE /api/v1/courses/:id`: require a valid admin JWT; missing/invalid tokens return `401`, and student tokens return `403`.
- The Axios client reads the token from `sessionStorage` and attaches it as a Bearer token. Logging out removes it.

Set `JWT_SECRET` to a unique secret of at least 32 random bytes and configure `JWT_EXPIRES_IN` before starting the API. See `server/.env.example`; never commit a real `.env` file or secret.

Admin accounts are provisioned from `ADMIN_EMAIL` and `ADMIN_PASSWORD` at server startup. Public registration always creates a student.

Student/admin accounts, courses, enrollments, and learning progress currently use in-memory stores for this learning-stage implementation. They are lost when the server restarts; replace these stores with database models before deployment.

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
- `GET /api/v1/enrollments/my-courses`
- `DELETE /api/v1/enrollments/:courseId`
- `PUT /api/v1/progress`
- `GET /api/v1/progress/my-progress`
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

The `/api/v1/auth/*`, `/api/v1/courses*`, `/api/v1/enrollments*`, and `/api/v1/progress*` routes expose the versioned task API. Course reads are public; course mutations require an admin token; enrollment and progress routes are student-only.

## AI design summary

The AI layer keeps deterministic logic in the backend while using the LLM for explanation and drafting. The planner graph follows the sequence:

- `load_signals` -> `compute_mastery` -> `select_items` -> `explain_plan` -> `validate_schema`

The mastery calculation uses performance signals (quiz score, lesson completion, and retry penalty) and converts them into a topic score in the 0-1 range. Guardrails enforce minimal input sizes, role-safe admin-only actions, and refusal rules when retrieved material does not support the answer.

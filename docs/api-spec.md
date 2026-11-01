# API reference

Base URL: `http://localhost:5000` (dev). All application routes are under **`/api/v1`**. JSON in, JSON out. A Postman collection that exercises every group with assertions is in `postman/` (`npm run test:postman`).

## Conventions

**Authentication.** `Authorization: Bearer <JWT>` (HS256, 1 hour by default, issuer `adaptlearn-api`, audience `adaptlearn-client`). The user is re-loaded from MongoDB on every request, so deactivating an account or changing a password takes effect immediately.

**Success envelope**

```json
{ "success": true, "message": "optional", "data": { }, "meta": { "page": 1, "limit": 12, "total": 3, "pages": 1 } }
```

**Error envelope** (never contains stack traces or internal messages)

```json
{ "success": false, "code": "VALIDATION_ERROR", "message": "Validation failed.",
  "details": [ { "in": "body", "path": "password", "message": "Password must be at least 12 characters." } ],
  "requestId": "6f1c2d8e-..." }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | schema failure (unknown field, wrong type, out of range) |
| 400 | `BAD_REQUEST` | malformed JSON, invalid id, operator-injection payload (`$`/`.` in a key) |
| 401 | `UNAUTHORIZED` | missing, invalid, expired or revoked token; wrong credentials |
| 403 | `FORBIDDEN` | wrong role, or not enrolled / not a classmate |
| 404 | `NOT_FOUND` | unknown route or resource (also used for drafts a student must not see) |
| 409 | `CONFLICT` | duplicate email, already enrolled |
| 413 | `PAYLOAD_TOO_LARGE` | body over 256 kB |
| 422 | `UNPROCESSABLE` | upstream playlist or AI output unusable |
| 429 | `RATE_LIMITED` | see limits below |
| 502/503 | `BAD_GATEWAY` / `SERVICE_UNAVAILABLE` | AI service or database problem |

Every response carries `X-Request-Id`; send your own `X-Request-Id` (8-64 safe characters) to correlate logs.

**Rate limits** (per 15 minutes unless noted; configurable by environment variable): global 300 per IP; login 10 **failed** attempts per IP + email (successes are not counted); registration 20 per hour per IP; AI endpoints 30 per 10 minutes per user. Limits return `429` and standard `RateLimit` headers.

**Pagination.** `?page=1&limit=12` (limit ≤ 50; chat history uses `before=<ISO date>&limit≤100`). Lists return `meta.total` and `meta.pages`.

**Health.** `GET /api/health` is liveness (never touches the database). `GET /api/health/ready` returns `{ status, database, ai }` and `503` when MongoDB is down.

## Endpoints (58)

Access: *Public*, *Optional* (public, but drafts and enrolment status are added for signed-in users), *Any signed-in*, *Student*, *Admin*.

#### Auth + profile

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | register limiter |
| `POST` | `/api/v1/auth/login` | Public | login limiter |
| `GET` | `/api/v1/auth/me` | Any signed-in | - |
| `POST` | `/api/v1/auth/change-password` | Any signed-in | - |
| `GET` | `/api/v1/profile` | Any signed-in | - |
| `PUT` | `/api/v1/profile` | Any signed-in | - |

#### Students (admin crud)

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/students` | Admin | - |
| `POST` | `/api/v1/students` | Admin | - |
| `GET` | `/api/v1/students/:id` | Admin | - |
| `PUT` | `/api/v1/students/:id` | Admin | - |
| `DELETE` | `/api/v1/students/:id` | Admin | - |

#### Courses + lessons

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/courses` | Optional | - |
| `POST` | `/api/v1/courses` | Admin | - |
| `GET` | `/api/v1/courses/:id` | Optional | - |
| `PUT` | `/api/v1/courses/:id` | Admin | - |
| `DELETE` | `/api/v1/courses/:id` | Admin | - |
| `GET` | `/api/v1/courses/:id/lessons` | Any signed-in | - |
| `POST` | `/api/v1/courses/:id/lessons` | Admin | - |
| `PUT` | `/api/v1/courses/:id/lessons/:lessonId` | Admin | - |
| `DELETE` | `/api/v1/courses/:id/lessons/:lessonId` | Admin | - |
| `GET` | `/api/v1/lessons/:lessonId` | Any signed-in | - |

#### Enrollments

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/enrollments/my-courses` | Student | - |
| `GET` | `/api/v1/enrollments` | Admin | - |
| `POST` | `/api/v1/enrollments` | Student | - |
| `DELETE` | `/api/v1/enrollments/:courseId` | Student | - |

#### Learning progress

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/progress/my-progress` | Student | - |
| `GET` | `/api/v1/progress/summary` | Student | - |
| `POST` | `/api/v1/progress/watch` | Student | - |
| `GET` | `/api/v1/progress/:courseId` | Student | - |
| `PUT` | `/api/v1/progress/:courseId/lessons/:lessonId` | Student | - |

#### Quizzes

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/quizzes` | Any signed-in | - |
| `POST` | `/api/v1/quizzes` | Admin | - |
| `GET` | `/api/v1/quizzes/:id` | Any signed-in | - |
| `PUT` | `/api/v1/quizzes/:id` | Admin | - |
| `DELETE` | `/api/v1/quizzes/:id` | Admin | - |
| `POST` | `/api/v1/quizzes/:id/attempts` | Student | - |
| `GET` | `/api/v1/quizzes/:id/attempts/me` | Student | - |

#### Notifications

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Any signed-in | - |
| `PATCH` | `/api/v1/notifications/read-all` | Any signed-in | - |
| `POST` | `/api/v1/notifications/broadcast` | Admin | - |
| `PATCH` | `/api/v1/notifications/:id/read` | Any signed-in | - |
| `DELETE` | `/api/v1/notifications/:id` | Any signed-in | - |

#### Chat history + rest send fallback

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/messages/contacts` | Any signed-in | - |
| `GET` | `/api/v1/messages/rooms` | Any signed-in | - |
| `GET` | `/api/v1/messages/rooms/:room` | Any signed-in | - |
| `GET` | `/api/v1/messages/dm/:userId` | Any signed-in | - |
| `POST` | `/api/v1/messages` | Any signed-in | - |

#### Ai (proxied to the fastapi service)

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `POST` | `/api/v1/ai/tutor` | Any signed-in | AI limiter |
| `GET` | `/api/v1/ai/plan/:courseId` | Student | AI limiter |
| `POST` | `/api/v1/ai/plan/:courseId/regenerate` | Student | AI limiter |
| `POST` | `/api/v1/ai/quiz/generate` | Admin | AI limiter |

#### Admin

| Method | Path | Access | Extra limit |
|---|---|---|---|
| `GET` | `/api/v1/admin/stats` | Admin | - |
| `GET` | `/api/v1/admin/reports/at-risk` | Admin | - |
| `GET` | `/api/v1/admin/reports/content-gaps` | Admin | - |
| `POST` | `/api/v1/admin/playlists/preview` | Admin | - |
| `POST` | `/api/v1/admin/courses/from-playlist` | Admin | - |
| `POST` | `/api/v1/admin/courses/:id/attach-playlist` | Admin | - |
| `POST` | `/api/v1/admin/courses/:id/reindex` | Admin | - |

## Selected request and response shapes

### Register and sign in

```http
POST /api/v1/auth/register
{ "name": "Asha Rao", "email": "asha@example.com", "password": "at-least-12-characters", "department": "CSE" }
-> 201 { "success": true, "data": { "user": { "id": "...", "role": "student", ... } } }   # role is always "student"

POST /api/v1/auth/login
{ "email": "asha@example.com", "password": "..." }
-> 200 { "data": { "token": "<jwt>", "tokenType": "Bearer", "expiresIn": "1h", "user": { ... } } }
```

Password rules: 12-72 bytes. Unknown fields (for example `role`) are rejected with `400`.

### Courses

`GET /courses?q=database&category=Computer%20Science&level=Intermediate&sort=newest|title|duration&page=1&limit=12`. `meta.categories` lists categories for the filter. For a signed-in student each course also has `enrollmentStatus`.

`GET /courses/:idOrSlug` returns `{ course, lessons[], enrollment, progress }`. Lesson summaries **omit notes and video ids**; those come from `GET /lessons/:id` and require enrolment (or admin).

### Progress and quizzes

```http
PUT /progress/:courseId/lessons/:lessonId     { "completed": true, "positionSec": 42 }   # idempotent
POST /progress/watch                          { "events": [ { "courseId","lessonId","event":"heartbeat","positionSec":30,"deltaSec":15 } ] }   # 202

GET  /quizzes?courseId=...                    # students: published only; admin: ?status=all
GET  /quizzes/:id                             # students never receive answerIndex or explanation
POST /quizzes/:id/attempts                    { "answers": [1, 0, -1] }   # one per question, -1 = skipped
-> 201 { "attempt": { "score": 2, "total": 3, "percent": 67 },
         "review": [ { "correct": true, "correctIndex": 1, "explanation": "..." } ] }
```

### AI

```http
POST /ai/tutor   { "courseId": "...", "lessonId": "...", "question": "Why are B+ tree leaves linked?", "history": [] }
-> 200 { "answer": "...", "grounded": true, "refused": false,
         "citations": [ { "lessonId": "...", "title": "B+ trees on Disks", "snippet": "..." } ], "generatedBy": "extractive" }

GET  /ai/plan/:courseId                 # cached; regenerates when progress or quiz results change
POST /ai/plan/:courseId/regenerate
POST /ai/quiz/generate  { "courseId": "...", "lessonId": "...", "count": 5, "difficulty": "medium" }   # admin; saved as a draft
```

`503` means the AI service is not configured or unreachable.

## Socket.IO

Connect with the same JWT: `io(url, { auth: { token } })`. An invalid or revoked token is rejected at the handshake (`connect_error`, `data.code = "UNAUTHORIZED"`). Every socket joins a private `user:<id>` room.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| client → server | `chat:join` | `{ room: "course:<id>" }` | ack `{ ok }`; only enrolled students or admins |
| client → server | `chat:leave` | `{ room }` | |
| client → server | `chat:send` | `{ room, text }` **or** `{ to: userId, text }` | exactly one target; text 1-2000 chars; ack `{ ok, message | error }`; max 20 events per 10 s per socket |
| client → server | `chat:typing` | `{ room }` | relayed to other members |
| client → server | `notifications:read-all` | `{}` | ack `{ ok }` |
| server → client | `chat:message` | `{ id, room, text, createdAt, sender: { id, name, role }, to? }` | course room members, or both participants of a DM |
| server → client | `chat:typing` | `{ room, user: { id, name } }` | |
| server → client | `notification:new` | notification document | also emitted when a coalesced DM notification is updated |

Direct messages are allowed between classmates (a shared active enrolment) and with administrators; students cannot message strangers.

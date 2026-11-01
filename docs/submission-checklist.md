# Submission checklist: Tasks 9-15

Legend: ✅ done and verified locally · 🟡 done, verified only with mocks · ⬜ needs you (cannot be done from the build environment)

Evidence paths are relative to the repository root. "Test" names refer to files in `server/tests`, `ai-service/tests`, `client/tests`, `e2e/flows.cjs` and `postman/`.

## Task 9: Student and Course Management

| Activity | Status | Evidence |
|---|---|---|
| 9.1 Packages | ✅ | `server/package.json` (exact pinned versions, lockfile) |
| 9.2 Student model | ✅ | `server/src/models/User.js` (role `student`) |
| 9.3 Course model | ✅ | `server/src/models/Course.js`, `Lesson.js` |
| 9.4 Registration and login | ✅ | `controllers/authController.js`; tests `auth.test.js`; Postman folder 01 |
| 9.5 Student CRUD controller | ✅ | `controllers/studentController.js`; test "students (admin CRUD)" |
| 9.6 Student routes | ✅ | `routes/index.js`; `docs/api-spec.md` |
| 9.7 Course CRUD | ✅ | `controllers/courseController.js`; test "courses and lessons" |
| 9.8 Postman testing | ✅ | `postman/adaptlearn.postman_collection.json`: 78 requests / 135 assertions, 0 failed |

## Task 10: JWT authentication and protected routes

| Activity | Status | Evidence |
|---|---|---|
| 10.1 JWT config | ✅ | `config/env.js` (secret ≥ 32 bytes enforced), `services/token.service.js` |
| 10.2 Login and token | ✅ | `authController.login`; Postman "Login student (saves token)" |
| 10.3 Auth middleware | ✅ | `middleware/auth.js` (re-loads user; rejects deactivated/stale tokens) |
| 10.4 Role middleware | ✅ | `requireRole`, `requireAdmin`, `requireStudent` |
| 10.5 Protect routes | ✅ | `security.test.js` checks all 15 admin routes return 403 for students and protected families return 401 |
| 10.6 Store and send JWT in React | ✅ | `client/src/lib/api.js` (request interceptor), `context/AuthContext.jsx` |
| 10.7 Authentication tests | ✅ | `auth.test.js` (13), `ratelimit.test.js`, `client/tests/auth.test.jsx`, E2E sign-in/guard steps |

## Task 11: Database schema and ER diagram

| Activity | Status | Evidence |
|---|---|---|
| 11.1 MongoDB configuration | ✅ | `config/db.js`, `.env.example` |
| 11.2 User and Course collections | ✅ | `models/User.js`, `Course.js` |
| 11.3 Enrollment | ✅ | `models/Enrollment.js` (unique student+course) |
| 11.4 Learning Progress | ✅ | `models/LearningProgress.js` |
| 11.5 Notification | ✅ | `models/Notification.js` |
| 11.6 Message | ✅ | `models/Message.js` |
| 11.7 Relationships / ER diagram | ✅ | `docs/data-model.md`, `docs/diagrams/er-core.png`, `er-learning.png`, `er-full.png` (+ Mermaid sources) |

## Task 12: Database integration and CRUD

| Activity | Status | Evidence |
|---|---|---|
| 12.1-12.2 Connection; connect before listening | ✅ | `config/db.js`, `server.js` (connects, provisions admin, seeds, then listens) |
| 12.3 Registration and login on MongoDB | ✅ | `authController`; `auth.test.js` ("stored password is a bcrypt hash") |
| 12.4 Student profile API | ✅ | `GET/PUT /api/v1/profile`; `auth.test.js`; Postman "Update own profile"; UI `pages/Profile.jsx` |
| 12.5 Database error handling | ✅ | `middleware/errorHandler.js` (validation, cast, duplicate key, connection errors → structured responses) |
| 12.6 Course CRUD uses MongoDB | ✅ | `courses.test.js` |
| 12.7 Test via Postman and React | ✅ | Postman folders 02-04; E2E steps 2-5 |

## Task 13: Real-time chat and notifications (Socket.IO)

| Activity | Status | Evidence |
|---|---|---|
| 13.1-13.3 Install, server, attach to Express | ✅ | `sockets/index.js`, `server.js` (JWT-authenticated handshake) |
| 13.4 Frontend origin | ✅ | `config/cors.js` (shared by Express and Socket.IO) |
| 13.5 React socket client | ✅ | `client/src/context/RealtimeContext.jsx` |
| 13.6-13.7 Chat component | ✅ | `client/src/pages/Chat.jsx` (course rooms, DMs, typing, offline fallback) |
| 13.8 Message history API | ✅ | `GET /messages/rooms/:room`, `GET /messages/dm/:userId`; `realtime.test.js` |
| 13.9-13.10 Notification API and display | ✅ | `controllers/notificationController.js`, bell + toasts in `components/Layout.jsx`, `pages/Notifications.jsx` |
| 13.11 Test real-time | ✅ | `realtime.test.js` (17 tests, real sockets); **browser E2E with two simultaneous students** (messages and notifications arrive without refresh) |

## Task 14: Optimisation, security and error handling

| Activity | Status | Evidence |
|---|---|---|
| 14.1 CORS | ✅ | allow-list, `config/cors.js`; test "applies a CORS allow-list" |
| 14.2 Request validation | ✅ | zod strict schemas `server/src/validators`; `middleware/validate.js` |
| 14.3 Password hashing | ✅ | bcrypt 12 rounds in `models/User.js`; test asserts the stored value is a hash |
| 14.4 Centralised errors | ✅ | `middleware/errorHandler.js`; Postman asserts the error shape on every negative case |
| 14.5 Security headers | ✅ | helmet; Postman "Security headers present"; client CSP (`client/csp.js`) |
| 14.6 Rate limiting | ✅ | `middleware/rateLimit.js`; `ratelimit.test.js` |
| 14.7 Query optimisation | ✅ | indexes on every query path, pagination caps, projections, aggregation for counts (`docs/data-model.md`) |
| 14.8 Logging | ✅ | `middleware/logger.js` (request id, no query strings or bodies) |
| 14.9 Environment variables | ✅ | `config/env.js` validates and fails fast; `.gitignore` excludes `.env`; templates `*.env.example` |
| 14.10 Common server errors | ✅ | malformed JSON, oversized body, bad ids, DB down → 400/413/400/503 (tests) |
| 14.11 Security testing | ✅ | `security.test.js` (13 tests), Postman folder 10, `docs/security.md` |

## Task 15: Deployment and testing

| Activity | Status | Evidence |
|---|---|---|
| 15.1 Prepare backend (start script, PORT, health) | ✅ | `server/package.json` `start`; `GET /api/health`, `/api/health/ready` |
| 15.2 Prepare frontend (env API URL) | ✅ | `client/.env.example`, `VITE_API_URL`, `VITE_SOCKET_URL` |
| 15.3 MongoDB Atlas | ⬜ | runbook `docs/deployment.md` §1; record the (redacted) cluster name here: ________ |
| 15.4 GitHub | ⬜ | push this repository; **repo URL:** ________ |
| 15.5 Render | 🟡 | `render.yaml` (valid YAML) + `docs/deployment.md` §2; **API URL:** ________ |
| 15.6 Vercel | 🟡 | `client/vercel.json` (valid JSON) + `docs/deployment.md` §3; **Web URL:** ________ |
| 15.7 React Router fallback | 🟡 | `vercel.json` rewrite; the same fallback is in `nginx.conf` |
| 15.8 Production CORS | ✅ (logic) / ⬜ (live) | `CLIENT_URL` allow-list, tested locally; confirm on the deployed pair |
| 15.9 Health endpoint | ✅ | `curl https://<api>/api/health` |
| 15.10 Test all production features | ⬜ | run `docs/deployment.md` §5 against the live URLs; Newman command included. Locally: 39 browser steps + 135 API assertions pass |
| 15.11 Fix common deployment errors | ✅ | `docs/deployment.md` §7 |
| 15.12 Update GitHub README | ✅ | `README.md` (setup, env vars, architecture, tests) |

## Extras beyond the brief

AI tutor, adaptive study plan, AI quiz drafts, Course Studio (YouTube playlists), at-risk and content-gap reports, design-token system with light/dark themes, Docker, CI, real-browser E2E. See `docs/ai-design.md`, `docs/evaluation-results.md`.

## Before you submit

1. Deploy (`docs/deployment.md`), fill in the blanks above, and take screenshots of the **live** site (home, login, a course, chat between two accounts, notification, the admin console).
2. In the deployed admin console attach the NPTEL playlist so lessons show video.
3. Take a screenshot of the Newman/Postman run against the live API (`npm run test:postman` locally is already green).
4. Make sure no `.env` file or secret is committed (`git status`, `git log -p | grep -i secret`).
5. Rotate the demo passwords if you used `SEED_DEMO_USERS`.

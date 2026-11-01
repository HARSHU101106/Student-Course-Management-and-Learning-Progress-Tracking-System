# Project task list: what was found, what was done, what remains

This is the audit of the uploaded `adaptlearn.zip` against the FACE Prep brief (Tasks 9–15, `docs/assignment/Task 9 to 15.pdf`) and the "industry-ready, works end to end" goal. It records the state **before** and **after** this work so the changes are traceable.

## 1. Findings in the uploaded project

| # | Area | What was actually there | Severity |
|---|---|---|---|
| 1 | Database (Tasks 11, 12) | **No database.** `server/src/models/*.js` were empty classes; every route read/wrote in-memory arrays that reset on restart. README said MongoDB, `docker-compose.yml` started PostgreSQL, the plan said Atlas. | Blocking |
| 2 | Security (Task 14) | `helmet`, rate limiting, logging and validation were no-op stubs. `cors()` allowed every origin. The error handler returned internal messages. `PUT /students/:id` did `Object.assign(student, request.body)` (mass assignment). `POST /admin/playlists/import` had **no authentication** and fetched caller-supplied URLs (SSRF). `GET /students` and `/notifications` were public. | Critical |
| 3 | Correctness | Quiz attempts scored **100% for any answers**; quiz GET returned the **correct answers** to the client; lessons were fabricated fallbacks; `/students` returned hard-coded fake people; notifications were one global list. | Critical |
| 4 | Real time (Task 13) | Socket.IO server echoed messages without authentication, rooms or persistence; the client did not even depend on `socket.io-client`. | Blocking |
| 5 | AI | The FastAPI service returned canned strings. No retrieval, no LLM, no real LangGraph graph. `verify_service_token` accepted **any** non-empty token. | Blocking for the AI features |
| 6 | Frontend | One 2,006-line `App.jsx`; `pages/*.jsx` were 3-line stubs; "published" state lived in the browser; progress lived in `localStorage`; no chat or notification UI; a mock-service-worker layer drifted from the API. | High |
| 7 | Config and DevOps | `JWT_SECRET` defaults, unpinned (`latest`) dependencies, no Dockerfiles, CI only checked that files exist, `.env.example` files disagreed with each other. | High |
| 8 | Documentation | `api-spec.md`, `architecture.md`, `er-diagram.md`, `evaluation-results.md` and the Postman collection were placeholders. | High |
| 9 | Tests | 8 server tests, all against the in-memory mock. | High |
| 10 | Content | Seed videos had made-up YouTube IDs. | Medium |

## 2. What was done (all of it verified, see `docs/testing.md`)

| Brief task | Delivered |
|---|---|
| 9 Secure authentication and registration | bcrypt (12 rounds), JWT (HS256, `iss`/`aud`, 1 h), 12-character password policy, uniform login errors, timing-safe login, login/register rate limits, role never accepted from the client, revocation on password change or deactivation. |
| 10 Student profile and role-based access | `GET/PUT /profile`, `requireRole`, admin-only student CRUD, student/admin route guards in the UI. |
| 11 Database schema and ER diagram | 13 Mongoose models with constraints and indexes. `docs/data-model.md`, `docs/diagrams/er-*.png`. |
| 12 Database integration (CRUD) | Courses, lessons, enrollments, progress, quizzes, notifications, students, messages, all persisted; search, filter, pagination; cascades; seed script. |
| 13 WebSockets | Authenticated Socket.IO: course rooms, direct messages, typing, live notifications, persisted history, per-socket flood control, REST fallback. |
| 14 Optimisation, security, error handling | helmet, CORS allow-list, global + route rate limits, NoSQL operator guard, strict zod schemas, structured errors with request ids, graceful shutdown, strict CSP on the client. `docs/security.md`. |
| 15 Deployment and testing | Dockerfiles, nginx, `docker-compose.yml`, `render.yaml`, `client/vercel.json`, GitHub Actions CI, 89 + 87 + 28 automated tests, 39 real-browser steps, 78-request Postman collection run with Newman. |
| AI layer (project extension) | Real LangGraph pipelines: grounded tutor with citations, guardrails, adaptive study planner driven by a mastery model, AI quiz drafts, Course Studio outline; offline mode needs no API key; OpenAI/Azure ready. Measured in `docs/evaluation-results.md`. |
| Frontend | Rebuilt as ~25 modules on a three-layer design-token system (light/dark, WCAG AA verified), admin console, chat, notifications, study plan. |

Bugs that **only the real-browser end-to-end run found** (and are fixed with regression tests): a chat page crash caused by a `useEffect` returning a non-function in real Chromium (jsdom hid it); the AI tutor tying a short, new question to the previous topic; a PII redactor that missed `+91 98765 43210`; a stemmer that turned "trees" into "tre"; no progress bar for a freshly enrolled student.

## 3. What remains (needs you, or could not be verified here)

| Item | Why it is open | How to close it |
|---|---|---|
| **Deploy** (Atlas + Render + Vercel) | I cannot create accounts or reach those services. The config files are syntactically validated only. | Follow `docs/deployment.md` (about 30 minutes), then fill in the URLs in `docs/submission-checklist.md`. |
| **Docker images** | No Docker in the sandbox, so `docker compose up` was not executed. | `docker compose up --build`; fix any environment-specific issue. |
| **Real LLM** (OpenAI/Azure) | No API key here. The provider code is tested against a mocked HTTP transport only. | Set `LLM_PROVIDER`/keys in `ai-service/.env`; re-run `npm run eval:ai`. |
| **Real YouTube** | The sandbox cannot reach YouTube, so the IFrame player and playlist import are verified with mocks only, and seeded lessons have **no videos**. | Course Studio → paste the NPTEL playlist URL, or open a seeded course → "Attach videos from a YouTube playlist". |
| **Screenshots of the deployed site** and the **GitHub repository link** | Depend on the deployment. | Capture after deploying. |
| Optional hardening | See "Known limitations" in `docs/security.md` (httpOnly-cookie sessions, refresh tokens, email verification and password reset, Redis adapter for multi-instance Socket.IO). | Out of scope for the brief. |

## 4. Intentional removals

* The 2,006-line `client/src/App.jsx`, its stub pages, and the MSW mock layer (`client/src/mocks`, `public/mockServiceWorker.js`) were replaced. They remain in git history if the Task 7 mock-API evidence is needed (`git log -- client/src/mocks`).
* `frontend-static/` (the HTML/CSS/JS deliverable for Tasks 2–5) is **unchanged**; it is a standalone mock-data prototype and does not talk to the API.

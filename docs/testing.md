# Testing (Task 15)

## Strategy

| Layer | Tool | Runs against | What it proves |
|---|---|---|---|
| API integration | Node test runner + supertest + socket.io-client | **real MongoDB 7**, real Socket.IO | business rules, authorisation, validation, cascades, real-time delivery, AI contract (against a fake FastAPI) |
| AI service | pytest | in-memory and real MongoDB store | retrieval, guardrails, graphs, provider wiring (mocked HTTP), planner rules |
| AI quality | `ai-service/eval` | seed catalogue | measurable answer quality (see `docs/evaluation-results.md`) |
| Client | Vitest + Testing Library | jsdom | forms, route guards, tutor, quiz, filters; source guards |
| API contract | Postman collection run with Newman | **running stack** | 78 requests, 135 assertions across auth, CRUD, progress, quizzes, AI, notifications, chat, admin, security |
| End to end | Puppeteer (real Chromium) | **running stack** under the production CSP | complete journeys with two simultaneous students and an admin |
| Static | `npm run lint:tokens` | client source | no hard-coded colours/spacing; `tokens.css` current |

## Latest results

| Suite | Result |
|---|---|
| `npm run test:server` | **89 passed**, 0 failed (11 suites) |
| `npm run test:ai` | **87 passed**, 0 failed |
| `npm run test:client` | **28 passed**, 0 failed |
| `npm run lint:tokens` | no violations; 36 foreground/background colour pairs checked at AA contrast in light and dark themes |
| `npm run test:postman` | **78 requests, 135 assertions, 0 failed** (average response 11 ms) |
| `npm run test:e2e` | **39 browser steps passed**; zero uncaught exceptions or console errors in any of the four browsers |
| `npm run eval:ai` | Hit@1 97.3 %, Hit@3 100 %, out-of-scope declined 100 %, injections refused 100 % |

Environment: Node 22, Python 3.12, MongoDB 7.0.34, headless Chromium 153.

### Browser E2E steps (`e2e/flows.cjs`)

1. **Visitor:** home renders; catalogue shows 3 courses; search narrows results and updates the URL; course page shows curriculum and a sign-in prompt; protected pages redirect to sign-in; unknown route shows 404.
2. **New student:** client-side password validation; registration lands on the dashboard; duplicate registration rejected; enrol; enrolment notification arrives live; lesson shows notes; mark complete updates progress; **AI tutor** answers with a cited source, declines an out-of-scope question, refuses a prompt-injection attempt.
3. **Quiz and plan:** graded quiz with explanations; dashboard study plan contains *Revisit* and *Next up* items.
4. **Real-time (two browsers):** both students join a course room; a message appears for the other **without refresh** in both directions; HTML in a message is shown as text; a direct message produces a toast and bell count on a different page; the notification centre shows and clears it; outsiders get 403 for the room and for DMs.
5. **Administrator:** students cannot open admin pages; admin dashboard statistics, at-risk and content-gap reports (with the nav on one row and no clipped tables); create a course, add a lesson and publish it **while a student is online (live toast)**; announcement reaches online students; AI draft quiz generated, **reviewed in the editor** and published; a quiz written by hand; Course Studio rejects a non-YouTube URL; student search, edit.
6. **Quality:** dark theme persists; 390 px mobile layout has no horizontal overflow; one `<h1>` and labelled controls on public pages; a deactivated user's session ends gracefully; API unreachable shows a clear error and recovers on retry.

## Defects found by testing (all fixed, each with a regression test)

| Found by | Defect |
|---|---|
| Server tests | `DUMMY_HASH` not exported (login would crash on unknown email) |
| AI tests | PII redactor missed `+91 98765 43210` and numbers at the end of a sentence; stemmer turned "trees" into "tre"; malformed LLM JSON returned zero questions instead of falling back; one matching rare word looked like a perfect retrieval match |
| **Browser E2E only** | chat page crashed in real Chrome (`useEffect` returned a value; jsdom hid it); tutor tied a short *new* question to the previous topic; fresh enrollees saw no progress bar; admin navigation wrapped and a table was clipped; refused injection attempts polluted the *content gaps* report |
| Mid-work regressions | a mid-line `//` comment broke course search (caught by the browser run, now covered by `courses.test.jsx`) |

## Not covered (be aware)

* **Deployed environment**, Docker images, a **live LLM** and **live YouTube** (the IFrame player and playlist import are tested with mocks; seeded lessons have no videos, so the player was not exercised in the browser).
* Cross-browser (Firefox/Safari) and real-device testing; only headless Chromium at desktop and 390 px widths.
* Load and soak testing. Rate limits and timeouts are set conservatively but not benchmarked beyond the Postman average above.
* Accessibility is checked by automated rules (labels, headings, contrast of tokens); there was no screen-reader session or full audit.
* The evaluation questions are authored by the same person who wrote the notes (a regression baseline, not an independent benchmark).

## Running everything yourself

```bash
npm run install:all && pip install -r ai-service/requirements-dev.txt
# MongoDB must be running on 127.0.0.1:27017
npm run test:server && npm run test:ai && npm run test:client && npm run lint:tokens
npm run test:postman && npm run test:e2e        # boot the stack themselves
```

CI (`.github/workflows/ci.yml`) runs the same suites on every push, with a MongoDB service container, and fails the build if AI quality drops below the documented baseline.

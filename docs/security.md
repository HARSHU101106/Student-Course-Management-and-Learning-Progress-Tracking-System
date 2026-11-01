# Security (Task 14)

## Threat model and controls

| Threat (OWASP 2021 / API Top 10) | Control | Where | Verified by |
|---|---|---|---|
| **Broken access control** (A01) | `requireAuth` + `requireRole`; students blocked from all 15 admin routes; enrolment required for lessons, quizzes, tutor, plan and course chat; DM only between classmates/instructors; quiz answers never sent before submission; drafts hidden | `middleware/auth.js`, controllers | `security.test.js` (forbids every admin route), `learning.test.js`, `realtime.test.js`, Postman folders 03-06, 08, 10 |
| **Cryptographic failures** (A02) | bcrypt 12 rounds; JWT HS256 with `iss`/`aud`; secret must be ≥ 32 bytes or the server will not start; `none`-algorithm and wrong-secret tokens rejected; passwords never serialised | `config/env.js`, `models/User.js`, `services/token.service.js` | `auth.test.js` |
| **Injection** (A03): NoSQL | Keys starting with `$` or containing `.` rejected in body, query and params; strict zod types mean only strings and numbers reach queries; regex search input is escaped | `middleware/sanitize.js`, `utils/http.js` | `security.test.js`, Postman "NoSQL operator payload" |
| **Insecure design / mass assignment** | Every schema is `.strict()`; role is never read from the client; `PUT /students/:id` whitelists fields | `validators/*` | `auth.test.js` ("self-assigning admin"), `security.test.js`, Postman |
| **Security misconfiguration** (A05) | `helmet`; CORS allow-list from `CLIENT_URL`; `x-powered-by` removed; fail-fast env validation; no defaults for secrets; body limit 256 kB; `trust proxy` configured for rate-limit accuracy | `app.js`, `config/*` | `security.test.js`, Postman "Security headers" |
| **Identification and authentication failures** (A07) | Login brute-force limit per IP + email; identical error for wrong password and unknown email; bcrypt always executed (no timing oracle); deactivated users locked out instantly; password change revokes older tokens; 12-char minimum | `middleware/rateLimit.js`, `controllers/authController.js` | `auth.test.js`, `ratelimit.test.js` |
| **SSRF** | Playlist import accepts only `youtube.com`/`youtu.be` hosts and a validated `list=` id; the outbound URL is built from constants, never from user input; `/admin` routes require an admin | `services/youtube.service.js` | `admin.test.js` ("makes no outbound request"), Postman |
| **Stored/reflected XSS** | React escapes all output; no `dangerouslySetInnerHTML` (enforced by a unit test); strict CSP forbids inline scripts; chat text stored verbatim and rendered as text | `client/src`, `client/csp.js` | `source-guards.test.js`, browser E2E ("HTML in a chat message is shown as text") |
| **Sensitive data exposure in errors** | Unexpected errors return a generic message plus request id; stack traces only in the server log | `middleware/errorHandler.js` | `security.test.js` |
| **Excessive resource use** | Global and per-route rate limits; AI limiter per user; per-socket flood control; pagination caps; body and socket buffer limits | `middleware/rateLimit.js`, `sockets/chat.socket.js` | `ratelimit.test.js`, `realtime.test.js` |
| **Prompt injection / unsafe AI output** | Input guard blocks instruction-override patterns; PII is redacted before any LLM call or log; answers must be supported by retrieved text (unsupported sentences dropped); AI quizzes are drafts | `ai-service/app/guardrails` | `test_core.py`, `test_tutor.py`, evaluation (8/8 injections refused) |
| **Service-to-service trust** | AI service requires a bearer token compared in constant time; refuses to run open when the token is unset; production requires 24+ characters | `ai-service/app/auth.py`, `config.py` | `test_core.py` |
| **Secrets in source control** | `.env*` ignored (templates tracked); no secrets in the repository | `.gitignore` | review |

## Content-Security-Policy

`client/csp.js` (applied by `vite preview`, `nginx.conf` and `vercel.json`): scripts only from `'self'`, `www.youtube.com` and `s.ytimg.com`; frames only from YouTube; no objects; `frame-ancestors 'none'`. Inline scripts are not allowed: the theme bootstrap lives in `public/theme-init.js`. The browser E2E runs under this policy and any violation fails the run (it passed with zero console errors).

## Passwords and sessions

* Minimum 12 characters, maximum 72 bytes (bcrypt limit), as in the brief's secure registration.
* Tokens last 1 hour (`JWT_EXPIRES_IN`). There is no server-side session list; **changing the password or deactivating the user invalidates every older token**.

## Logging

One line per request: id, method, path **without the query string**, status, size, time, user id. Bodies, tokens and passwords are never logged. The AI service logs no request bodies either (they contain student questions).

## Known limitations (be upfront about these in a review)

1. **JWT in `localStorage`.** Any XSS would expose it. The mitigations above reduce the likelihood; an httpOnly, SameSite cookie with CSRF protection is the stronger design and would be the next step.
2. **No refresh tokens or "log out everywhere"** beyond password change/deactivation.
3. **No email verification or password-reset flow** (needs an email provider).
4. **Rate limits are in-memory per instance.** Behind several instances use a shared store (Redis).
5. **Socket.IO is single-instance** (no Redis adapter).
6. **Registration reveals whether an email exists** (409), as the brief specifies; login does not.
7. **No transactions** around multi-document deletes (idempotent, re-runnable).
8. Dependency vulnerabilities were checked with `npm audit` at build time (0 found for server and client production dependencies); keep running it, and pin/upgrade Python packages on a schedule.
9. No penetration test or professional audit has been performed; the tests above are automated checks of the controls listed.

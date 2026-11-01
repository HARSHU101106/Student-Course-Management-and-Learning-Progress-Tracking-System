import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

function limiter({ windowMs, limit, message, keyGenerator, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator,
    handler: (_request, _response, next) => next(new ApiError(429, message)),
  });
}

const byIp = (request) => ipKeyGenerator(request.ip ?? "");
const byUser = (request) => (request.user ? `u:${request.user.id}` : byIp(request));

export const globalLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimitMax,
  message: "Too many requests. Please slow down and try again shortly.",
  keyGenerator: byIp,
});

/** Brute-force protection: failed attempts per IP + email. */
export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimitMax,
  message: "Too many sign-in attempts. Try again in 15 minutes.",
  skipSuccessfulRequests: true,
  keyGenerator: (request) =>
    `${byIp(request)}:${String(request.body?.email ?? "").toLowerCase().slice(0, 254)}`,
});

export const registerLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: env.authRateLimitMax * 2,
  message: "Too many registrations from this address. Try again later.",
  keyGenerator: byIp,
});

/** LLM calls are the expensive resource; limit per authenticated user. */
export const aiLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: env.aiRateLimitMax,
  message: "AI request limit reached. Please wait a few minutes.",
  keyGenerator: byUser,
});

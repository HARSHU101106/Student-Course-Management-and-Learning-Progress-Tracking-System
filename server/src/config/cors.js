import { env } from "./env.js";

/**
 * Origin allow-list shared by Express CORS and Socket.IO CORS.
 * Requests without an Origin header (curl, Postman, server-to-server) are allowed.
 */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return env.clientOrigins.includes(origin.replace(/\/+$/, ""));
}

export const corsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id", "RateLimit"],
  credentials: false,
  maxAge: 600,
};

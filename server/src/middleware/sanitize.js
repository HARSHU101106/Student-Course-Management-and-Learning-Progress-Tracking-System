import { ApiError } from "../utils/ApiError.js";

const FORBIDDEN_KEY = /^\$|\./;
const MAX_DEPTH = 8;

function inspect(value, depth = 0) {
  if (depth > MAX_DEPTH) return false;
  if (Array.isArray(value)) return value.every((item) => inspect(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.entries(value).every(
      ([key, nested]) => !FORBIDDEN_KEY.test(key) && inspect(nested, depth + 1),
    );
  }
  return true;
}

/**
 * Rejects NoSQL-injection payloads: object keys that start with "$" or contain ".".
 * (express-mongo-sanitize mutates req.query, which is read-only in Express 5.)
 */
export function rejectOperatorInjection(request, _response, next) {
  const parts = [request.body, request.query, request.params];
  if (!parts.every((part) => part === undefined || inspect(part))) {
    return next(ApiError.badRequest("Request contains disallowed characters in field names."));
  }
  return next();
}

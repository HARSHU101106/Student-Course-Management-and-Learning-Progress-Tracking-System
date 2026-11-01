import { User } from "../models/index.js";
import { verifyToken } from "../services/token.service.js";
import { ApiError } from "../utils/ApiError.js";

function bearerToken(request) {
  const header = request.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Resolve a JWT into a live user. Rejects deleted/deactivated users and stale tokens. */
export async function resolveUser(token) {
  let claims;
  try {
    claims = verifyToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired token.");
  }

  const user = await User.findById(claims.sub).select("+passwordChangedAt");
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Invalid or expired token.");
  }
  if (user.passwordChangedAt && claims.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }
  return user;
}

export async function requireAuth(request, _response, next) {
  const token = bearerToken(request);
  if (!token) return next(ApiError.unauthorized("Authentication token is required."));
  try {
    request.user = await resolveUser(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Attaches request.user when a valid token is present; never rejects. */
export async function optionalAuth(request, _response, next) {
  const token = bearerToken(request);
  if (!token) return next();
  try {
    request.user = await resolveUser(token);
  } catch {
    /* anonymous */
  }
  return next();
}

export function requireRole(...roles) {
  if (roles.length === 0) throw new Error("requireRole needs at least one role.");
  return (request, _response, next) => {
    if (!request.user) return next(ApiError.unauthorized());
    if (!roles.includes(request.user.role)) {
      return next(ApiError.forbidden("Access denied. Insufficient permissions."));
    }
    return next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireStudent = requireRole("student");

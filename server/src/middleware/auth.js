import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(request, response, next) {
  const authorization = request.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return response.status(401).json({
      message: "Authentication token is required.",
    });
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return response.status(401).json({
      message: "Authentication token is required.",
    });
  }
  if (Buffer.byteLength(env.jwtSecret, "utf8") < 32) {
    return response.status(500).json({
      message: "Authentication is not configured.",
    });
  }

  try {
    const claims = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    if (typeof claims === "string" || !claims.sub || !claims.email) {
      return response.status(401).json({ message: "Invalid or expired token." });
    }

    request.user = {
      id: claims.sub,
      email: claims.email,
      role: claims.role || "student",
    };
  } catch {
    return response.status(401).json({ message: "Invalid or expired token." });
  }
  return next();
}

export function requireRole(role) {
  return (request, response, next) => {
    if (!request.user || request.user.role !== role) {
      return response.status(403).json({ message: "Access denied." });
    }

    return next();
  };
}

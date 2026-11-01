import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ISSUER = "adaptlearn-api";
const AUDIENCE = "adaptlearn-client";

export function signToken(user) {
  return jwt.sign({ role: user.role, email: user.email }, env.jwtSecret, {
    subject: String(user.id),
    expiresIn: env.jwtExpiresIn,
    algorithm: "HS256",
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

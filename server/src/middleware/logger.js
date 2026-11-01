import morgan from "morgan";
import { env } from "../config/env.js";

morgan.token("id", (request) => request.id);
morgan.token("uid", (request) => request.user?.id ?? "-");

// Method, path without query string (avoids logging tokens/PII in URLs), status, timing.
morgan.token("path", (request) => request.originalUrl.split("?")[0]);

export const httpLogger = morgan(
  ":id :method :path :status :res[content-length]B :response-time ms uid=:uid",
  { skip: () => env.isTest },
);

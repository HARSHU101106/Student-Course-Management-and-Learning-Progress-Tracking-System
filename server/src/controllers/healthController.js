import { databaseState } from "../config/db.js";
import { ai, aiConfigured } from "../services/ai.service.js";

/** Liveness: the process is up (does not touch MongoDB). */
export function liveness(_request, response) {
  response.status(200).json({
    status: "ok",
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
}

/** Readiness: database and optional AI service. */
export async function readiness(_request, response) {
  const database = databaseState();
  let aiStatus = "not-configured";
  if (aiConfigured()) {
    aiStatus = await ai.health().then(() => "up").catch(() => "down");
  }
  const ready = database === "connected";
  response.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    database,
    ai: aiStatus,
    timestamp: new Date().toISOString(),
  });
}

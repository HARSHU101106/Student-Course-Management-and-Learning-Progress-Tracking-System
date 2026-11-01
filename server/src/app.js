import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { liveness, readiness } from "./controllers/healthController.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { httpLogger } from "./middleware/logger.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { rejectOperatorInjection } from "./middleware/sanitize.js";
import routes from "./routes/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Render/Vercel/Nginx sit in front of the app; this makes req.ip (rate limiting) the real client.
  app.set("trust proxy", env.trustProxy);

  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: "256kb" }));

  // Health endpoints are exempt from rate limiting so platform probes never get a 429.
  app.get("/api/health", liveness);
  app.get("/api/health/ready", readiness);
  app.get("/", (_request, response) =>
    response.json({ name: "AdaptLearn API", status: "ok", docs: "/api/health" }),
  );

  app.use("/api/v1", globalLimiter, rejectOperatorInjection, routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

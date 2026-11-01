import http from "node:http";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { createSocketServer } from "./sockets/index.js";
import { ensureAdminAccount } from "./services/bootstrap.service.js";

async function main() {
  await connectDatabase();
  console.log(JSON.stringify({ level: "info", msg: "MongoDB connected" }));

  await ensureAdminAccount();
  if (env.seedOnBoot) {
    const { seedDemoData } = await import("./scripts/seed.js");
    await seedDemoData();
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);

  // Render/Heroku-style platforms may keep connections alive longer than Node's defaults.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  await new Promise((resolve) => server.listen(env.port, resolve));
  console.log(JSON.stringify({ level: "info", msg: "AdaptLearn API listening", port: env.port, env: env.nodeEnv }));

  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    console.log(JSON.stringify({ level: "info", msg: "Shutting down", signal }));
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({ level: "error", msg: "Unhandled rejection", reason: String(reason) }));
});

main().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", msg: "Startup failed", error: error.message }));
  process.exit(1);
});

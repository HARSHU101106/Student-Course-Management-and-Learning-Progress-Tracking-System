import http from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { env } from "./config/env.js";
import { createAdminAccount } from "./services/auth.service.js";
import { registerSockets } from "./sockets/index.js";

const port = env.port;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

registerSockets(io);

async function startServer() {
  if (Boolean(env.adminEmail) !== Boolean(env.adminPassword)) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must both be configured.");
  }

  if (env.adminEmail) {
    await createAdminAccount({
      email: env.adminEmail,
      password: env.adminPassword,
    });
  }

  server.listen(port, () => console.log(`AdaptLearn server listening on ${port}`));
}

startServer().catch((error) => {
  console.error("AdaptLearn server startup failed:", error.message);
  process.exitCode = 1;
});

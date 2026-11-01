import { Server } from "socket.io";
import { isAllowedOrigin } from "../config/cors.js";
import { resolveUser } from "../middleware/auth.js";
import { bindSocketServer, userRoom } from "../services/realtime.js";
import { registerChatHandlers } from "./chat.socket.js";
import { registerNotificationHandlers } from "./notify.socket.js";

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 16 * 1024,
    pingTimeout: 20_000,
  });

  // Every connection must present a valid JWT. The user is re-loaded from MongoDB so
  // deactivated accounts and role changes take effect immediately.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !token) throw new Error("Authentication token is required.");
      socket.data.user = await resolveUser(token);
      next();
    } catch (error) {
      const denied = new Error(error.message || "Unauthorized");
      denied.data = { code: "UNAUTHORIZED" };
      next(denied);
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket.data;
    socket.join(userRoom(user.id));
    registerChatHandlers(io, socket);
    registerNotificationHandlers(io, socket);
  });

  bindSocketServer(io);
  return io;
}

import http from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { registerSockets } from "./sockets/index.js";

const port = process.env.PORT ?? 4000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

registerSockets(io);

server.listen(port, () => console.log(`AdaptLearn server listening on ${port}`));

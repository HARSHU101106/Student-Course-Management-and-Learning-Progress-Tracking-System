import { registerChatSocket } from "./chat.socket.js";
import { registerNotifySocket } from "./notify.socket.js";
import { registerTutorSocket } from "./tutor.socket.js";

export function registerSockets(io) {
  registerNotifySocket(io);
  registerChatSocket(io);
  registerTutorSocket(io);
}

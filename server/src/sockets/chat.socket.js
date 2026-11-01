import { canJoinCourseRoom, sendMessage } from "../services/message.service.js";

const WINDOW_MS = 10_000;
const MAX_EVENTS = 20;

/** Sliding-window limiter per socket so a client cannot flood a room. */
function createBucket() {
  let stamps = [];
  return () => {
    const now = Date.now();
    stamps = stamps.filter((stamp) => now - stamp < WINDOW_MS);
    if (stamps.length >= MAX_EVENTS) return false;
    stamps.push(now);
    return true;
  };
}

function reply(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

export function registerChatHandlers(_io, socket) {
  const { user } = socket.data;
  const allow = createBucket();

  socket.on("chat:join", async (payload, ack) => {
    const room = payload?.room;
    if (typeof room !== "string" || !(await canJoinCourseRoom(user, room))) {
      return reply(ack, { ok: false, error: "You are not a member of this course chat." });
    }
    await socket.join(room);
    return reply(ack, { ok: true, room });
  });

  socket.on("chat:leave", async (payload, ack) => {
    if (typeof payload?.room === "string") await socket.leave(payload.room);
    reply(ack, { ok: true });
  });

  socket.on("chat:send", async (payload, ack) => {
    if (!allow()) return reply(ack, { ok: false, error: "You are sending messages too quickly." });
    try {
      const { room, to, text } = payload ?? {};
      if (typeof text !== "string" || (Boolean(room) === Boolean(to))) {
        return reply(ack, { ok: false, error: "Provide text and exactly one of room or to." });
      }
      // Reload the user so a role/active change since connecting is honoured.
      const message = await sendMessage(user, { room, to, text });
      return reply(ack, { ok: true, message });
    } catch (error) {
      return reply(ack, { ok: false, error: error.status < 500 ? error.message : "Could not send message." });
    }
  });

  socket.on("chat:typing", (payload) => {
    if (!allow()) return;
    const room = payload?.room;
    if (typeof room === "string" && socket.rooms.has(room)) {
      socket.to(room).emit("chat:typing", { room, user: { id: user.id, name: user.name } });
    }
  });
}

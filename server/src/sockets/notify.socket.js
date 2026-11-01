import { Notification } from "../models/index.js";

export function registerNotificationHandlers(_io, socket) {
  const { user } = socket.data;

  socket.on("notifications:read-all", async (_payload, ack) => {
    try {
      await Notification.updateMany({ user: user.id, read: false }, { read: true });
      if (typeof ack === "function") ack({ ok: true, unread: 0 });
    } catch {
      if (typeof ack === "function") ack({ ok: false, error: "Could not update notifications." });
    }
  });
}

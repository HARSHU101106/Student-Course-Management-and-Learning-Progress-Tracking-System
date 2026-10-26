export function registerChatSocket(io) {
  io.on("connection", (socket) => {
    socket.on("chat:send", (payload, acknowledgement) => {
      const message = typeof payload === "string" ? payload : payload?.message || "";
      if (!message.trim()) {
        if (typeof acknowledgement === "function") acknowledgement({ ok: false, error: "Message is required." });
        return;
      }

      const response = {
        id: Date.now(),
        user: "tutor",
        text: `I can help with that: "${message.trim()}"`,
      };

      socket.emit("chat:reply", response);
      if (typeof acknowledgement === "function") acknowledgement({ ok: true, message: response });
    });
  });
}

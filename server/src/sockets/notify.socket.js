export function registerNotifySocket(io) {
  io.on("connection", (socket) => {
    socket.on("notifications:read-all", (acknowledgement) => {
      if (typeof acknowledgement === "function") {
        acknowledgement({ ok: true, unread: 0 });
      }
      socket.emit("notifications:updated", { unread: 0 });
    });
  });
}

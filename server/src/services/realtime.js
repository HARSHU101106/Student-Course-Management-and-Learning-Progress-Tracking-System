let io = null;

export function bindSocketServer(server) {
  io = server;
}

export function getIo() {
  return io;
}

export const userRoom = (userId) => `user:${userId}`;

export async function isOnline(userId) {
  if (!io) return false;
  return (await io.in(userRoom(userId)).fetchSockets()).length > 0;
}

import { Enrollment, Notification, User } from "../models/index.js";
import { getIo, userRoom } from "./realtime.js";

function emitNotification(doc) {
  getIo()?.to(userRoom(doc.user)).emit("notification:new", doc.toJSON());
}

/** Persist a notification for each user and push it live to any connected sockets. */
export async function notifyUsers(userIds, { type = "system", title, body = "", link = "", meta } = {}) {
  const ids = [...new Set(userIds.map(String))];
  if (ids.length === 0) return [];
  const docs = await Notification.insertMany(
    ids.map((user) => ({ user, type, title, body, link, meta })),
  );
  docs.forEach(emitNotification);
  return docs;
}

export async function notifyCourseStudents(courseId, payload, { excludeUserId } = {}) {
  const rows = await Enrollment.find({ course: courseId, status: { $in: ["active", "completed"] } })
    .select("student")
    .lean();
  const ids = rows.map((row) => String(row.student)).filter((id) => id !== String(excludeUserId));
  return notifyUsers(ids, payload);
}

export async function notifyAllStudents(payload) {
  const rows = await User.find({ role: "student", isActive: true }).select("_id").lean();
  return notifyUsers(rows.map((row) => row._id), payload);
}

/**
 * Coalesces direct-message notifications: one unread notification per sender,
 * updated in place with a running count instead of one notification per message.
 */
export async function notifyDirectMessage(recipientId, sender, preview) {
  const existing = await Notification.findOne({
    user: recipientId,
    type: "message",
    read: false,
    "meta.from": String(sender.id),
  });
  const snippet = preview.length > 80 ? `${preview.slice(0, 77)}...` : preview;

  if (existing) {
    const count = (existing.meta?.count ?? 1) + 1;
    existing.title = `${count} new messages from ${sender.name}`;
    existing.body = snippet;
    existing.meta = { from: String(sender.id), count };
    existing.markModified("meta");
    await existing.save();
    emitNotification(existing);
    return existing;
  }

  const [doc] = await notifyUsers([recipientId], {
    type: "message",
    title: `New message from ${sender.name}`,
    body: snippet,
    link: `/chat?dm=${sender.id}`,
    meta: { from: String(sender.id), count: 1 },
  });
  return doc;
}

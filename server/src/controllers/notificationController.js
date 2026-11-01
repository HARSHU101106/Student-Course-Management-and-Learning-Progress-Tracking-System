import { Course, Notification } from "../models/index.js";
import { notifyAllStudents, notifyCourseStudents } from "../services/notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, paginationMeta } from "../utils/http.js";

export async function listNotifications(request, response) {
  const { unread, page, limit } = request.valid.query;
  const filter = { user: request.user.id };
  if (unread) filter.read = unread === "false";

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: request.user.id, read: false }),
  ]);
  return ok(response, items, { meta: { ...paginationMeta({ page, limit, total }), unreadCount } });
}

export async function markRead(request, response) {
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, user: request.user.id },
    { read: true },
    { new: true },
  );
  if (!notification) throw ApiError.notFound("Notification not found.");
  return ok(response, { notification });
}

export async function markAllRead(request, response) {
  const result = await Notification.updateMany({ user: request.user.id, read: false }, { read: true });
  return ok(response, { updated: result.modifiedCount });
}

export async function deleteNotification(request, response) {
  const result = await Notification.deleteOne({ _id: request.params.id, user: request.user.id });
  if (!result.deletedCount) throw ApiError.notFound("Notification not found.");
  return ok(response, { deleted: true });
}

export async function broadcast(request, response) {
  const { title, body, courseId, link } = request.valid.body;
  const payload = { type: "announcement", title, body, link: link ?? "" };

  let docs;
  if (courseId) {
    if (!(await Course.exists({ _id: courseId }))) throw ApiError.notFound("Course not found.");
    docs = await notifyCourseStudents(courseId, payload);
  } else {
    docs = await notifyAllStudents(payload);
  }
  return ok(response, { recipients: docs.length }, { status: 201, message: "Announcement sent." });
}

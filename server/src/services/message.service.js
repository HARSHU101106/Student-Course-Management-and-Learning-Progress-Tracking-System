import { Course, Enrollment, Message, User, dmRoom } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { assertCourseAccess } from "./course.service.js";
import { notifyDirectMessage } from "./notification.service.js";
import { getIo, userRoom } from "./realtime.js";

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(text) {
  return String(text).replace(CONTROL_CHARS, "").trim();
}

export function courseRoomId(room) {
  const match = /^course:([a-f\d]{24})$/i.exec(room ?? "");
  return match ? match[1] : null;
}

/** Courses a user may chat in: any course for admins, otherwise non-dropped enrollments. */
export async function chatCourseIds(user) {
  if (user.role === "admin") {
    return (await Course.find({ status: "published" }).select("_id").lean()).map((c) => String(c._id));
  }
  const rows = await Enrollment.find({ student: user.id, status: { $in: ["active", "completed"] } })
    .select("course")
    .lean();
  return rows.map((row) => String(row.course));
}

export async function canJoinCourseRoom(user, room) {
  const courseId = courseRoomId(room);
  if (!courseId) return false;
  const course = await Course.findById(courseId);
  if (!course) return false;
  try {
    await assertCourseAccess(user, course);
    return true;
  } catch {
    return false;
  }
}

/** Students may message admins and classmates; admins may message any active user. */
export async function canMessage(sender, recipient) {
  if (String(sender.id) === String(recipient.id)) return false;
  if (!recipient.isActive) return false;
  if (sender.role === "admin" || recipient.role === "admin") return true;
  const mine = await chatCourseIds(sender);
  if (mine.length === 0) return false;
  return Boolean(
    await Enrollment.exists({
      student: recipient.id,
      course: { $in: mine },
      status: { $in: ["active", "completed"] },
    }),
  );
}

function present(doc, sender) {
  return {
    id: String(doc._id),
    room: doc.room,
    text: doc.text,
    createdAt: doc.createdAt,
    sender: { id: String(sender.id), name: sender.name, role: sender.role },
    ...(doc.recipient ? { to: String(doc.recipient) } : {}),
  };
}

/** Single send path used by both Socket.IO and the REST fallback. */
export async function sendMessage(sender, { room, to, text }) {
  const body = cleanText(text);
  if (!body) throw ApiError.badRequest("Message cannot be empty.");
  if (body.length > 2000) throw ApiError.badRequest("Message is too long (max 2000 characters).");

  const io = getIo();

  if (room) {
    const courseId = courseRoomId(room);
    if (!courseId) throw ApiError.badRequest("Invalid room.");
    if (!(await canJoinCourseRoom(sender, room))) {
      throw ApiError.forbidden("You are not a member of this course chat.");
    }
    const doc = await Message.create({ room, sender: sender.id, course: courseId, text: body });
    const message = present(doc, sender);
    io?.to(room).emit("chat:message", message);
    return message;
  }

  const recipient = await User.findById(to);
  if (!recipient) throw ApiError.notFound("Recipient not found.");
  if (!(await canMessage(sender, recipient))) {
    throw ApiError.forbidden("You can only message classmates and instructors.");
  }
  const doc = await Message.create({
    room: dmRoom(sender.id, recipient.id),
    sender: sender.id,
    recipient: recipient.id,
    text: body,
  });
  const message = present(doc, sender);
  io?.to(userRoom(recipient.id)).to(userRoom(sender.id)).emit("chat:message", message);
  await notifyDirectMessage(recipient.id, sender, body);
  return message;
}

export function presentHistory(docs) {
  return docs
    .map((doc) => ({
      id: String(doc._id),
      room: doc.room,
      text: doc.text,
      createdAt: doc.createdAt,
      sender: doc.sender
        ? { id: String(doc.sender._id ?? doc.sender), name: doc.sender.name ?? "Former user", role: doc.sender.role ?? "student" }
        : { id: "", name: "Former user", role: "student" },
      ...(doc.recipient ? { to: String(doc.recipient) } : {}),
    }))
    .reverse();
}

import mongoose from "mongoose";
import { Course, Message, User, dmRoom } from "../models/index.js";
import {
  canJoinCourseRoom,
  canMessage,
  chatCourseIds,
  courseRoomId,
  presentHistory,
  sendMessage,
} from "../services/message.service.js";
import { ApiError } from "../utils/ApiError.js";
import { created, ok } from "../utils/http.js";

export async function contacts(request, response) {
  const me = request.user;
  let users;
  if (me.role === "admin") {
    users = await User.find({ _id: { $ne: me._id }, isActive: true }).select("name role department").sort({ name: 1 }).limit(200);
  } else {
    const { Enrollment } = await import("../models/index.js");
    const mine = await chatCourseIds(me);
    const classmates = await Enrollment.find({
      course: { $in: mine },
      student: { $ne: me._id },
      status: { $in: ["active", "completed"] },
    }).distinct("student");
    users = await User.find({
      isActive: true,
      $or: [{ _id: { $in: classmates } }, { role: "admin" }],
    })
      .select("name role department")
      .sort({ name: 1 });
  }
  return ok(response, users.map((user) => ({ id: user.id, name: user.name, role: user.role, department: user.department })));
}

export async function rooms(request, response) {
  const me = request.user;
  const courseIds = await chatCourseIds(me);
  const courses = await Course.find({ _id: { $in: courseIds } }).select("title slug").sort({ title: 1 });

  const meId = new mongoose.Types.ObjectId(me.id);
  const threads = await Message.aggregate([
    { $match: { room: /^dm:/, $or: [{ sender: meId }, { recipient: meId }] } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$room", last: { $first: "$$ROOT" } } },
    { $sort: { "last.createdAt": -1 } },
    { $limit: 30 },
  ]);

  const partnerIds = threads.map((thread) =>
    String(thread.last.sender) === me.id ? thread.last.recipient : thread.last.sender,
  );
  const partners = await User.find({ _id: { $in: partnerIds } }).select("name role").lean();
  const byId = new Map(partners.map((partner) => [String(partner._id), partner]));

  return ok(response, {
    courses: courses.map((course) => ({ room: `course:${course.id}`, id: course.id, title: course.title })),
    direct: threads
      .map((thread, index) => {
        const partner = byId.get(String(partnerIds[index]));
        return (
          partner && {
            room: thread._id,
            partner: { id: String(partner._id), name: partner.name, role: partner.role },
            lastMessage: { text: thread.last.text, createdAt: thread.last.createdAt },
          }
        );
      })
      .filter(Boolean),
  });
}

function historyFilter(room, query) {
  const filter = { room };
  if (query.before) filter.createdAt = { $lt: new Date(query.before) };
  return filter;
}

export async function roomHistory(request, response) {
  const { room } = request.valid.params;
  if (!courseRoomId(room) || !(await canJoinCourseRoom(request.user, room))) {
    throw ApiError.forbidden("You are not a member of this course chat.");
  }
  const { limit, ...query } = request.valid.query;
  const docs = await Message.find(historyFilter(room, query))
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name role");
  return ok(response, presentHistory(docs), { meta: { hasMore: docs.length === limit } });
}

export async function dmHistory(request, response) {
  const { userId } = request.valid.params;
  if (userId === request.user.id) throw ApiError.badRequest("You cannot message yourself.");
  const other = await User.findById(userId).select("name role isActive");
  if (!other) throw ApiError.notFound("User not found.");

  // The room id is derived from the caller's own id, so only their own conversations are reachable.
  const room = dmRoom(request.user.id, userId);
  const { limit, ...query } = request.valid.query;
  const docs = await Message.find(historyFilter(room, query))
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name role");
  return ok(response, presentHistory(docs), {
    meta: { hasMore: docs.length === limit, canSend: await canMessage(request.user, other) },
  });
}

export async function postMessage(request, response) {
  const message = await sendMessage(request.user, request.valid.body);
  return created(response, { message });
}

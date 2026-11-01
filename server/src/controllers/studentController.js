import {
  Enrollment,
  LearningProgress,
  Message,
  Notification,
  QuizAttempt,
  StudyPlan,
  TopicMastery,
  TutorQuery,
  User,
  WatchEvent,
} from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { created, escapeRegex, ok, paginationMeta } from "../utils/http.js";

const studentOnly = { role: "student" };

async function loadStudent(id) {
  const student = await User.findOne({ _id: id, ...studentOnly });
  if (!student) throw ApiError.notFound("Student not found.");
  return student;
}

export async function listStudents(request, response) {
  const { q, status, page, limit } = request.valid.query;
  const filter = { ...studentOnly };
  if (status) filter.isActive = status === "active";
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { department: pattern }];
  }

  const [students, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const counts = await Enrollment.aggregate([
    { $match: { student: { $in: students.map((s) => s._id) }, status: { $ne: "dropped" } } },
    { $group: { _id: "$student", n: { $sum: 1 } } },
  ]);
  const byStudent = new Map(counts.map((row) => [String(row._id), row.n]));

  return ok(
    response,
    students.map((student) => ({ ...student.toJSON(), enrollmentCount: byStudent.get(String(student._id)) ?? 0 })),
    { meta: paginationMeta({ page, limit, total }) },
  );
}

export async function getStudent(request, response) {
  return ok(response, { student: await loadStudent(request.params.id) });
}

export async function createStudent(request, response) {
  const { name, email, password, department } = request.valid.body;
  if (await User.exists({ email })) throw ApiError.conflict("Email already registered.");
  const student = await User.create({ name, email, password, department, role: "student" });
  return created(response, { student }, "Student created.");
}

export async function updateStudent(request, response) {
  const student = await loadStudent(request.params.id);
  const { password, email, ...rest } = request.valid.body;

  if (email && email !== student.email) {
    if (await User.exists({ email, _id: { $ne: student._id } })) {
      throw ApiError.conflict("Email already registered.");
    }
    student.email = email;
  }
  Object.assign(student, rest);
  if (password) {
    student.password = password;
    student.passwordChangedAt = new Date();
  }
  await student.save();
  return ok(response, { student }, { message: "Student updated." });
}

export async function deleteStudent(request, response) {
  const student = await loadStudent(request.params.id);
  const id = student._id;
  await Promise.all([
    Enrollment.deleteMany({ student: id }),
    LearningProgress.deleteMany({ student: id }),
    QuizAttempt.deleteMany({ student: id }),
    TopicMastery.deleteMany({ student: id }),
    StudyPlan.deleteMany({ student: id }),
    TutorQuery.deleteMany({ student: id }),
    WatchEvent.deleteMany({ student: id }),
    Notification.deleteMany({ user: id }),
    Message.deleteMany({ $or: [{ sender: id }, { recipient: id }] }),
  ]);
  await student.deleteOne();
  return ok(response, { deleted: true, id: String(id) }, { message: "Student deleted." });
}

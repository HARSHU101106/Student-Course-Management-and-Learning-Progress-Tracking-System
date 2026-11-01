import { Course, Enrollment, LearningProgress } from "../models/index.js";
import { notifyUsers } from "../services/notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import { created, ok, paginationMeta } from "../utils/http.js";

const courseFields = "title slug category level duration lessonCount status";

export async function enroll(request, response) {
  const course = await Course.findById(request.valid.body.courseId);
  if (!course || course.status !== "published") throw ApiError.notFound("Course not found.");

  let enrollment = await Enrollment.findOne({ student: request.user.id, course: course._id });
  if (enrollment && enrollment.status !== "dropped") {
    throw ApiError.conflict("You are already enrolled in this course.");
  }

  if (enrollment) {
    // Re-enrolling after dropping keeps earlier progress.
    enrollment.status = "active";
    enrollment.enrolledAt = new Date();
    await enrollment.save();
  } else {
    try {
      enrollment = await Enrollment.create({ student: request.user.id, course: course._id });
    } catch (error) {
      if (error?.code === 11000) throw ApiError.conflict("You are already enrolled in this course.");
      throw error;
    }
  }

  await notifyUsers([request.user.id], {
    type: "enrollment",
    title: "Enrollment confirmed",
    body: `You are now enrolled in ${course.title}.`,
    link: `/courses/${course.slug}`,
  });

  return created(response, { enrollment }, "Course enrollment successful.");
}

export async function myCourses(request, response) {
  const statuses = request.valid.query?.status ? [request.valid.query.status] : ["active", "completed"];
  const enrollments = await Enrollment.find({ student: request.user.id, status: { $in: statuses } })
    .sort({ enrolledAt: -1 })
    .populate("course", courseFields);

  const progressRows = await LearningProgress.find({
    student: request.user.id,
    course: { $in: enrollments.map((item) => item.course?._id).filter(Boolean) },
  });
  const progressByCourse = new Map(progressRows.map((row) => [String(row.course), row]));

  const items = enrollments
    .filter((item) => item.course)
    .map((item) => {
      const progress = progressByCourse.get(String(item.course._id));
      return {
        id: item.id,
        status: item.status,
        enrolledAt: item.enrolledAt,
        completedAt: item.completedAt ?? null,
        course: item.course.toJSON(),
        progress: {
          percent: progress?.percent ?? 0,
          completedLessons: progress?.completedLessons ?? 0,
          totalLessons: item.course.lessonCount,
          lastLesson: progress?.lastLesson ? String(progress.lastLesson) : null,
        },
      };
    });

  return ok(response, items, { meta: { total: items.length } });
}

export async function unenroll(request, response) {
  const enrollment = await Enrollment.findOne({
    student: request.user.id,
    course: request.valid.params.courseId,
    status: { $ne: "dropped" },
  });
  if (!enrollment) throw ApiError.notFound("You are not enrolled in this course.");
  enrollment.status = "dropped";
  await enrollment.save();
  return ok(response, { courseId: String(enrollment.course) }, { message: "Successfully unenrolled from course." });
}

export async function listEnrollments(request, response) {
  const { courseId, status, page, limit } = request.valid.query;
  const filter = {};
  if (courseId) filter.course = courseId;
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ enrolledAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("student", "name email department")
      .populate("course", "title slug"),
    Enrollment.countDocuments(filter),
  ]);
  return ok(response, items, { meta: paginationMeta({ page, limit, total }) });
}

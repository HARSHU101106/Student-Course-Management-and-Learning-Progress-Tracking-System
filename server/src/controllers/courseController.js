import { Course, Enrollment, LearningProgress, Lesson } from "../models/index.js";
import { ai, aiConfigured, scheduleReindex } from "../services/ai.service.js";
import {
  assertCourseAccess,
  deleteCourseCascade,
  findCourse,
  recountLessons,
  uniqueSlug,
} from "../services/course.service.js";
import { notifyAllStudents } from "../services/notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import { created, escapeRegex, ok, paginationMeta } from "../utils/http.js";

const SORTS = {
  newest: { createdAt: -1 },
  title: { title: 1 },
  duration: { duration: 1, title: 1 },
};

function lessonSummary(lesson) {
  return {
    id: String(lesson._id),
    order: lesson.order,
    title: lesson.title,
    module: lesson.module,
    durationSec: lesson.durationSec,
    topics: lesson.topics,
    hasVideo: Boolean(lesson.videoId),
  };
}

export async function listCourses(request, response) {
  const { q, category, level, status, sort, page, limit } = request.valid.query;
  const isAdmin = request.user?.role === "admin";
  const filter = {};

  // Only admins may see drafts.
  if (!isAdmin || !status) filter.status = "published";
  else if (status !== "all") filter.status = status;

  if (category) filter.category = category;
  if (level) filter.level = level;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: pattern }, { description: pattern }, { tags: pattern }, { category: pattern }];
  }

  const [courses, total, categories] = await Promise.all([
    Course.find(filter)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit),
    Course.countDocuments(filter),
    Course.distinct("category", isAdmin ? {} : { status: "published" }),
  ]);

  let enrollmentByCourse = new Map();
  if (request.user?.role === "student" && courses.length) {
    const rows = await Enrollment.find({ student: request.user.id, course: { $in: courses.map((c) => c._id) } })
      .select("course status")
      .lean();
    enrollmentByCourse = new Map(rows.map((row) => [String(row.course), row.status]));
  }

  return ok(
    response,
    courses.map((course) => ({
      ...course.toJSON(),
      enrollmentStatus: enrollmentByCourse.get(String(course._id)) ?? null,
    })),
    { meta: { ...paginationMeta({ page, limit, total }), categories: categories.sort() } },
  );
}

export async function getCourse(request, response) {
  const course = await findCourse(request.valid.params.id);
  if (course.status !== "published" && request.user?.role !== "admin") {
    throw ApiError.notFound("Course not found.");
  }

  const lessons = await Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean();
  const body = { course: course.toJSON(), lessons: lessons.map(lessonSummary), enrollment: null, progress: null };

  if (request.user?.role === "student") {
    const [enrollment, progress] = await Promise.all([
      Enrollment.findOne({ student: request.user.id, course: course._id }),
      LearningProgress.findOne({ student: request.user.id, course: course._id }),
    ]);
    body.enrollment = enrollment;
    body.progress = progress && {
      percent: progress.percent,
      completedLessons: progress.completedLessons,
      totalLessons: progress.totalLessons,
      completedLessonIds: progress.completedLessonIds.map(String),
      lastLesson: progress.lastLesson ? String(progress.lastLesson) : null,
    };
  }
  return ok(response, body);
}

export async function createCourse(request, response) {
  const data = request.valid.body;
  const course = await Course.create({
    ...data,
    slug: await uniqueSlug(data.title),
    status: data.status ?? "draft",
    createdBy: request.user.id,
  });
  if (course.status === "published") {
    await notifyAllStudents({
      type: "course",
      title: "New course available",
      body: course.title,
      link: `/courses/${course.slug}`,
    });
  }
  return created(response, { course }, "Course created.");
}

export async function updateCourse(request, response) {
  const course = await findCourse(request.params.id);
  const wasPublished = course.status === "published";
  Object.assign(course, request.valid.body);
  await course.save();

  if (!wasPublished && course.status === "published") {
    await notifyAllStudents({
      type: "course",
      title: "New course available",
      body: course.title,
      link: `/courses/${course.slug}`,
    });
  }
  return ok(response, { course }, { message: "Course updated." });
}

export async function deleteCourse(request, response) {
  const course = await findCourse(request.params.id);
  await deleteCourseCascade(course._id);
  if (aiConfigured()) ai.removeIndex(String(course._id)).catch(() => {});
  return ok(response, { deleted: true, id: String(course._id) }, { message: "Course deleted." });
}

/* ------------------------------ lessons ------------------------------ */

export async function listLessons(request, response) {
  const course = await findCourse(request.params.id);
  if (request.user?.role !== "admin") await assertCourseAccess(request.user, course);
  const lessons = await Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 });
  return ok(response, lessons);
}

export async function getLesson(request, response) {
  const lesson = await Lesson.findById(request.params.lessonId);
  if (!lesson) throw ApiError.notFound("Lesson not found.");
  const course = await Course.findById(lesson.course);
  await assertCourseAccess(request.user, course);

  const siblings = await Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).select("_id title").lean();
  const index = siblings.findIndex((item) => String(item._id) === String(lesson._id));
  const progress =
    request.user.role === "student"
      ? await LearningProgress.findOne({ student: request.user.id, course: course._id })
      : null;

  return ok(response, {
    lesson,
    course: { id: course.id, title: course.title, slug: course.slug },
    position: { index: index + 1, total: siblings.length },
    previous: index > 0 ? { id: String(siblings[index - 1]._id), title: siblings[index - 1].title } : null,
    next:
      index < siblings.length - 1
        ? { id: String(siblings[index + 1]._id), title: siblings[index + 1].title }
        : null,
    completed: Boolean(progress?.completedLessonIds.some((id) => String(id) === String(lesson._id))),
    resumeAtSec: progress?.lessonPositions?.get(String(lesson._id)) ?? 0,
  });
}

export async function createLesson(request, response) {
  const course = await findCourse(request.params.id);
  const data = request.valid.body;
  let order = data.order;
  if (order === undefined) {
    const last = await Lesson.findOne({ course: course._id }).sort({ order: -1 }).select("order").lean();
    order = (last?.order ?? 0) + 1;
  }
  const lesson = await Lesson.create({ ...data, order, course: course._id });
  await recountLessons(course._id);
  scheduleReindex(course._id);
  return created(response, { lesson }, "Lesson added.");
}

async function loadLessonOfCourse(courseId, lessonId) {
  const course = await findCourse(courseId);
  const lesson = await Lesson.findOne({ _id: lessonId, course: course._id });
  if (!lesson) throw ApiError.notFound("Lesson not found.");
  return { course, lesson };
}

export async function updateLesson(request, response) {
  const { course, lesson } = await loadLessonOfCourse(request.params.id, request.params.lessonId);
  Object.assign(lesson, request.valid.body);
  await lesson.save();
  scheduleReindex(course._id);
  return ok(response, { lesson }, { message: "Lesson updated." });
}

export async function deleteLesson(request, response) {
  const { course, lesson } = await loadLessonOfCourse(request.params.id, request.params.lessonId);
  await lesson.deleteOne();
  await recountLessons(course._id);

  // Keep stored progress consistent with the lessons that still exist.
  const { refreshProgress } = await import("../services/progress.service.js");
  const affected = await LearningProgress.find({ course: course._id });
  for (const progress of affected) await refreshProgress(progress, course.title);

  scheduleReindex(course._id);
  return ok(response, { deleted: true, id: String(lesson._id) }, { message: "Lesson deleted." });
}

import { Course, Enrollment, LearningProgress, Lesson, WatchEvent } from "../models/index.js";
import { getOrCreateProgress, refreshProgress } from "../services/progress.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ok } from "../utils/http.js";

async function requireActiveEnrollment(studentId, courseId) {
  const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
  if (!enrollment || enrollment.status === "dropped") {
    throw ApiError.forbidden("You must be enrolled in this course.");
  }
  return enrollment;
}

function presentProgress(progress, course) {
  return {
    id: progress.id,
    course: course && { id: course.id, title: course.title, slug: course.slug },
    completedLessons: progress.completedLessons,
    totalLessons: progress.totalLessons,
    percent: progress.percent,
    completedLessonIds: progress.completedLessonIds.map(String),
    lastLesson: progress.lastLesson ? String(progress.lastLesson) : null,
    watchSeconds: progress.watchSeconds,
    lastAccessedAt: progress.lastAccessedAt,
  };
}

export async function myProgress(request, response) {
  const enrollments = await Enrollment.find({
    student: request.user.id,
    status: { $in: ["active", "completed"] },
  }).populate("course", "title slug lessonCount");

  const rows = await LearningProgress.find({
    student: request.user.id,
    course: { $in: enrollments.map((item) => item.course?._id).filter(Boolean) },
  });
  const byCourse = new Map(rows.map((row) => [String(row.course), row]));

  const items = enrollments
    .filter((item) => item.course)
    .map((item) => {
      const row = byCourse.get(String(item.course._id));
      return {
        status: item.status,
        ...(row
          ? presentProgress(row, item.course)
          : {
              id: null,
              course: { id: item.course.id, title: item.course.title, slug: item.course.slug },
              completedLessons: 0,
              totalLessons: item.course.lessonCount,
              percent: 0,
              completedLessonIds: [],
              lastLesson: null,
              watchSeconds: 0,
              lastAccessedAt: item.enrolledAt,
            }),
      };
    });

  return ok(response, items, { meta: { total: items.length } });
}

export async function courseProgress(request, response) {
  const { courseId } = request.valid.params;
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("Course not found.");
  await requireActiveEnrollment(request.user.id, courseId);

  const progress = await getOrCreateProgress(request.user.id, courseId);
  if (progress.isNew) await refreshProgress(progress, course.title);
  return ok(response, { progress: presentProgress(progress, course) });
}

export async function setLessonProgress(request, response) {
  const { courseId, lessonId } = request.valid.params;
  const { completed, positionSec } = request.valid.body;

  const course = await Course.findById(courseId);
  if (!course || course.status !== "published") throw ApiError.notFound("Course not found.");
  await requireActiveEnrollment(request.user.id, courseId);

  const lesson = await Lesson.findOne({ _id: lessonId, course: courseId });
  if (!lesson) throw ApiError.notFound("Lesson not found in this course.");

  const progress = await getOrCreateProgress(request.user.id, courseId);
  const already = progress.completedLessonIds.some((id) => String(id) === String(lessonId));
  if (completed && !already) progress.completedLessonIds.push(lesson._id);
  if (!completed && already) {
    progress.completedLessonIds = progress.completedLessonIds.filter((id) => String(id) !== String(lessonId));
  }
  if (positionSec !== undefined) progress.lessonPositions.set(String(lessonId), Math.floor(positionSec));
  progress.lastLesson = lesson._id;

  await refreshProgress(progress, course.title);
  return ok(response, { progress: presentProgress(progress, course) }, { message: "Learning progress updated successfully." });
}

export async function recordWatch(request, response) {
  const { events } = request.valid.body;

  // Only keep events for courses the student is actually enrolled in.
  const courseIds = [...new Set(events.map((event) => event.courseId))];
  const enrolled = await Enrollment.find({
    student: request.user.id,
    course: { $in: courseIds },
    status: { $in: ["active", "completed"] },
  })
    .select("course")
    .lean();
  const allowed = new Set(enrolled.map((row) => String(row.course)));
  const accepted = events.filter((event) => allowed.has(event.courseId));

  if (accepted.length) {
    await WatchEvent.insertMany(
      accepted.map((event) => ({
        student: request.user.id,
        course: event.courseId,
        lesson: event.lessonId,
        event: event.event,
        positionSec: event.positionSec,
        deltaSec: event.deltaSec,
      })),
    );
    // Per course: total watched seconds, and the latest known position for each lesson (for resume).
    const perCourse = new Map();
    for (const event of accepted) {
      const entry = perCourse.get(event.courseId) ?? { seconds: 0, positions: {} };
      entry.seconds += event.deltaSec;
      if (event.event !== "play") entry.positions[`lessonPositions.${event.lessonId}`] = Math.floor(event.positionSec);
      perCourse.set(event.courseId, entry);
    }
    await Promise.all(
      [...perCourse].map(([courseId, entry]) =>
        LearningProgress.updateOne(
          { student: request.user.id, course: courseId },
          {
            $inc: { watchSeconds: entry.seconds },
            $set: { lastAccessedAt: new Date(), ...entry.positions },
            $setOnInsert: { totalLessons: 0 },
          },
          { upsert: true },
        ),
      ),
    );
  }
  return ok(response, { accepted: accepted.length, ignored: events.length - accepted.length }, { status: 202 });
}

export async function summary(request, response) {
  const [enrollments, progressRows, weekEvents] = await Promise.all([
    Enrollment.find({ student: request.user.id, status: { $in: ["active", "completed"] } }).lean(),
    LearningProgress.find({ student: request.user.id }).lean(),
    WatchEvent.aggregate([
      {
        $match: {
          student: request.user._id,
          at: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
      },
      { $group: { _id: null, seconds: { $sum: "$deltaSec" } } },
    ]),
  ]);

  const active = enrollments.filter((item) => item.status === "active");
  const enrolledCourseIds = new Set(enrollments.map((item) => String(item.course)));
  const rows = progressRows.filter((row) => enrolledCourseIds.has(String(row.course)));
  const averagePercent = enrollments.length
    ? Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / enrollments.length)
    : 0;

  return ok(response, {
    enrolled: enrollments.length,
    inProgress: active.length,
    completed: enrollments.length - active.length,
    averagePercent,
    lessonsCompleted: rows.reduce((sum, row) => sum + row.completedLessons, 0),
    minutesThisWeek: Math.round((weekEvents[0]?.seconds ?? 0) / 60),
  });
}

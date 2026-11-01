import {
  Course,
  Enrollment,
  LearningProgress,
  Lesson,
  QuizAttempt,
  TopicMastery,
  TutorQuery,
  User,
} from "../models/index.js";
import { ai, aiConfigured, syncCourseIndex } from "../services/ai.service.js";
import { findCourse, recountLessons, uniqueSlug } from "../services/course.service.js";
import { notifyAllStudents } from "../services/notification.service.js";
import { importYouTubePlaylist, matchVideosToLessons } from "../services/youtube.service.js";
import { ApiError } from "../utils/ApiError.js";
import { created, ok } from "../utils/http.js";

const DAY = 24 * 60 * 60 * 1000;

export async function stats(_request, response) {
  const since = new Date(Date.now() - 7 * DAY);
  const [students, courses, published, enrollments, completions, attempts, activeStudents, avg] = await Promise.all([
    User.countDocuments({ role: "student" }),
    Course.countDocuments(),
    Course.countDocuments({ status: "published" }),
    Enrollment.countDocuments({ status: { $ne: "dropped" } }),
    Enrollment.countDocuments({ status: "completed" }),
    QuizAttempt.countDocuments(),
    LearningProgress.distinct("student", { lastAccessedAt: { $gte: since } }),
    QuizAttempt.aggregate([{ $group: { _id: null, avg: { $avg: "$percent" } } }]),
  ]);
  return ok(response, {
    students,
    courses,
    publishedCourses: published,
    enrollments,
    completions,
    quizAttempts: attempts,
    activeStudents7d: activeStudents.length,
    averageQuizPercent: Math.round(avg[0]?.avg ?? 0),
  });
}

export async function atRisk(request, response) {
  const { courseId } = request.valid.query;
  const filter = { status: "active" };
  if (courseId) filter.course = courseId;

  const enrollments = await Enrollment.find(filter)
    .populate("student", "name email isActive")
    .populate("course", "title");
  const studentIds = enrollments.map((item) => item.student?._id).filter(Boolean);

  const [progressRows, masteryRows] = await Promise.all([
    LearningProgress.find({ student: { $in: studentIds } }).lean(),
    TopicMastery.find({ student: { $in: studentIds } }).lean(),
  ]);
  const progressKey = new Map(progressRows.map((row) => [`${row.student}:${row.course}`, row]));
  const masteryKey = new Map();
  for (const row of masteryRows) {
    const key = `${row.student}:${row.course}`;
    if (!masteryKey.has(key)) masteryKey.set(key, []);
    masteryKey.get(key).push(row);
  }

  const items = [];
  for (const enrollment of enrollments) {
    if (!enrollment.student || !enrollment.course || !enrollment.student.isActive) continue;
    const key = `${enrollment.student._id}:${enrollment.course._id}`;
    const progress = progressKey.get(key);
    const mastery = masteryKey.get(key) ?? [];
    const attemptsCount = mastery.reduce((sum, row) => sum + row.attempts, 0);
    const avgMastery = mastery.length ? mastery.reduce((sum, row) => sum + row.score, 0) / mastery.length : null;
    const lastActive = progress?.lastAccessedAt ?? enrollment.enrolledAt;
    const inactiveDays = Math.floor((Date.now() - new Date(lastActive).getTime()) / DAY);
    const sinceEnroll = Math.floor((Date.now() - enrollment.enrolledAt.getTime()) / DAY);
    const percent = progress?.percent ?? 0;

    const reasons = [];
    if (inactiveDays >= 7) reasons.push(`Inactive for ${inactiveDays} days`);
    if (avgMastery !== null && attemptsCount >= 3 && avgMastery < 0.4) reasons.push("Low quiz mastery");
    if (percent < 20 && sinceEnroll >= 14) reasons.push("Slow start (under 20% after 2 weeks)");
    if (!reasons.length) continue;

    items.push({
      student: { id: enrollment.student.id, name: enrollment.student.name, email: enrollment.student.email },
      course: { id: enrollment.course.id, title: enrollment.course.title },
      percent,
      averageMastery: avgMastery === null ? null : Math.round(avgMastery * 100),
      inactiveDays,
      reasons,
      riskLevel: reasons.length >= 2 ? "high" : "medium",
    });
  }
  items.sort((a, b) => b.reasons.length - a.reasons.length || b.inactiveDays - a.inactiveDays);
  return ok(response, items, { meta: { total: items.length } });
}

/**
 * Questions the tutor could not ground in course material: gaps in the content.
 * Refused questions (prompt-injection attempts, empty input) are policy events, not content gaps.
 */
export async function contentGaps(_request, response) {
  const rows = await TutorQuery.find({ grounded: false, refused: false })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("course", "title")
    .lean();
  return ok(
    response,
    rows.map((row) => ({
      id: String(row._id),
      question: row.question,
      course: row.course ? { id: String(row.course._id), title: row.course.title } : null,
      refused: row.refused,
      at: row.createdAt,
    })),
  );
}

export async function previewPlaylist(request, response) {
  return ok(response, await importYouTubePlaylist(request.valid.body.url));
}

export async function createFromPlaylist(request, response) {
  const body = request.valid.body;
  const playlist = await importYouTubePlaylist(body.url);
  const title = body.title ?? playlist.title;

  const course = await Course.create({
    title,
    slug: await uniqueSlug(title),
    description: body.description ?? (playlist.description.trim() || `Imported from the YouTube playlist "${playlist.title}".`).slice(0, 2000),
    category: body.category,
    level: body.level,
    duration: Math.max(1, Math.ceil(playlist.items.length / 3)),
    instructor: playlist.channel,
    status: body.publish ? "published" : "draft",
    source: { type: "youtube-playlist", playlistId: playlist.playlistId, channel: playlist.channel },
    createdBy: request.user.id,
  });

  let lessons = await Lesson.insertMany(
    playlist.items.map((item, index) => ({
      course: course._id,
      order: index + 1,
      title: item.title.slice(0, 200),
      description: item.description.slice(0, 1000),
      videoId: item.videoId,
      sourceIndex: index + 1,
    })),
  );
  await recountLessons(course._id);

  // Best effort: let the AI Course Studio group lessons into modules and tag topics.
  let enriched = false;
  if (aiConfigured()) {
    try {
      const outline = await ai.outline(
        { title, items: lessons.map((lesson) => ({ id: String(lesson._id), title: lesson.title, description: lesson.description })) },
        request.id,
      );
      const byId = new Map((outline.lessons ?? []).map((item) => [item.id, item]));
      await Lesson.bulkWrite(
        lessons
          .filter((lesson) => byId.has(String(lesson._id)))
          .map((lesson) => {
            const item = byId.get(String(lesson._id));
            return {
              updateOne: {
                filter: { _id: lesson._id },
                update: { $set: { module: String(item.module ?? "").slice(0, 120), topics: (item.topics ?? []).slice(0, 12) } },
              },
            };
          }),
      );
      enriched = true;
    } catch {
      /* the course is still usable without enrichment */
    }
    syncCourseIndex(course._id).catch(() => {});
  }

  if (course.status === "published") {
    await notifyAllStudents({ type: "course", title: "New course available", body: course.title, link: `/courses/${course.slug}` });
  }
  lessons = await Lesson.find({ course: course._id }).sort({ order: 1 });
  return created(response, { course, lessonCount: lessons.length, enriched }, "Course created from playlist.");
}

export async function attachPlaylist(request, response) {
  const course = await findCourse(request.params.id);
  const playlist = await importYouTubePlaylist(request.valid.body.url);
  const lessons = await Lesson.find({ course: course._id }).sort({ order: 1 });

  const { matches, unmatched } = matchVideosToLessons(lessons, playlist.items);
  if (matches.length) {
    await Lesson.bulkWrite(
      matches.map((match) => ({
        updateOne: { filter: { _id: match.lessonId }, update: { $set: { videoId: match.videoId } } },
      })),
    );
    course.source = { type: "youtube-playlist", playlistId: playlist.playlistId, channel: playlist.channel };
    await course.save();
  }
  return ok(
    response,
    { matched: matches, unmatchedLessonIds: unmatched, playlistTitle: playlist.title, videosInPlaylist: playlist.items.length },
    { message: `Attached ${matches.length} of ${lessons.length} lessons to videos.` },
  );
}

export async function reindexCourse(request, response) {
  const course = await findCourse(request.params.id);
  if (!aiConfigured()) throw ApiError.unavailable("The AI service is not configured.");
  const result = await syncCourseIndex(course._id);
  return ok(response, result, { message: "Course re-indexed for the AI tutor." });
}

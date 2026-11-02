import { createHash } from "node:crypto";
import { Course, LearningProgress, Lesson, Quiz, StudyPlan, TopicMastery, TutorQuery } from "../models/index.js";
import { ai } from "../services/ai.service.js";
import { assertCourseAccess } from "../services/course.service.js";
import { ApiError } from "../utils/ApiError.js";
import { created, ok } from "../utils/http.js";

const PLAN_TTL_MS = 6 * 60 * 60 * 1000;

async function accessibleCourse(user, courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("Course not found.");
  await assertCourseAccess(user, course);
  return course;
}

export async function askTutor(request, response) {
  const { courseId, lessonId, question, history } = request.valid.body;
  const course = await accessibleCourse(request.user, courseId);
  if (lessonId && !(await Lesson.exists({ _id: lessonId, course: course._id }))) {
    throw ApiError.badRequest("The lesson does not belong to this course.");
  }

  const startedAt = Date.now();
  const answer = await ai.tutor({ courseId, lessonId, question, history: history ?? [] }, request.id);

  await TutorQuery.create({
    student: request.user.id,
    course: course._id,
    lesson: lessonId,
    question: question.slice(0, 500),
    grounded: Boolean(answer.grounded),
    refused: Boolean(answer.refused),
    citationCount: answer.citations?.length ?? 0,
    latencyMs: Date.now() - startedAt,
  }).catch(() => {});

  return ok(response, answer);
}

async function buildPlan(user, course, requestId) {
  const [lessons, mastery, progress] = await Promise.all([
    Lesson.find({ course: course._id }).sort({ order: 1 }).select("title topics order").lean(),
    TopicMastery.find({ student: user.id, course: course._id }).lean(),
    LearningProgress.findOne({ student: user.id, course: course._id }).lean(),
  ]);

  const completed = (progress?.completedLessonIds ?? []).map(String);
  const signature = createHash("sha1")
    .update(JSON.stringify({ completed: completed.sort(), mastery: mastery.map((m) => [m.topic, m.score]).sort() }))
    .digest("hex");

  const existing = await StudyPlan.findOne({ student: user.id, course: course._id });
  return { lessons, mastery, completed, signature, existing, requestId };
}

async function generate(user, course, context) {
  const result = await ai.plan(
    {
      courseId: String(course._id),
      courseTitle: course.title,
      weeklyHours: user.weeklyHours,
      lessons: context.lessons.map((lesson) => ({
        id: String(lesson._id),
        title: lesson.title,
        order: lesson.order,
        topics: lesson.topics,
      })),
      completedLessonIds: context.completed,
      mastery: context.mastery.map((row) => ({
        topic: row.topic,
        score: row.score,
        attempts: row.attempts,
        lastAssessedAt: row.lastAssessedAt,
      })),
    },
    context.requestId,
  );

  return StudyPlan.findOneAndUpdate(
    { student: user.id, course: course._id },
    {
      items: result.items,
      summary: result.summary ?? "",
      generatedBy: result.generatedBy ?? "rules",
      signature: context.signature,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function getPlan(request, response) {
  const course = await accessibleCourse(request.user, request.valid.params.courseId);
  const context = await buildPlan(request.user, course, request.id);
  const fresh =
    context.existing &&
    context.existing.signature === context.signature &&
    Date.now() - context.existing.updatedAt.getTime() < PLAN_TTL_MS;
  if (fresh) return ok(response, { plan: context.existing, cached: true });

  try {
    return ok(response, { plan: await generate(request.user, course, context), cached: false });
  } catch (error) {
    // Degrade gracefully: an older plan is better than an error page.
    if (context.existing && error.status >= 500) {
      return ok(response, { plan: context.existing, cached: true, stale: true });
    }
    throw error;
  }
}

export async function regeneratePlan(request, response) {
  const course = await accessibleCourse(request.user, request.valid.params.courseId);
  const context = await buildPlan(request.user, course, request.id);
  return ok(response, { plan: await generate(request.user, course, context), cached: false });
}

export async function generateQuiz(request, response) {
  const { courseId, lessonId, count, difficulty } = request.valid.body;
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("Course not found.");
  const lesson = lessonId ? await Lesson.findOne({ _id: lessonId, course: courseId }) : null;
  if (lessonId && !lesson) throw ApiError.badRequest("The lesson does not belong to this course.");

  const result = await ai.generateQuiz({ courseId, lessonId, count, difficulty }, request.id);
  const questions = (result.questions ?? []).filter(
    (q) =>
      q?.prompt &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      Number.isInteger(q.answerIndex) &&
      q.answerIndex >= 0 &&
      q.answerIndex < q.options.length,
  );
  if (questions.length < count) {
    throw new ApiError(422, `The AI service returned ${questions.length} questions but ${count} were requested.`);
  }
  if (questions.length === 0) {
    throw new ApiError(422, "The AI service could not produce valid questions from the available material.");
  }

  const quiz = await Quiz.create({
    course: course._id,
    lesson: lesson?._id,
    title: lesson ? `${lesson.title} (AI draft)` : `${course.title} (AI draft)`,
    questions,
    status: "draft",
    source: "ai",
    createdBy: request.user.id,
  });
  return created(response, { quiz }, "Draft quiz generated. Review it before publishing.");
}

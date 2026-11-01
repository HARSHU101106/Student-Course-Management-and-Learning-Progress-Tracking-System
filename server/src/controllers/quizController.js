import { Course, Lesson, Quiz, QuizAttempt } from "../models/index.js";
import { assertCourseAccess } from "../services/course.service.js";
import { applyAttemptToMastery } from "../services/mastery.service.js";
import { notifyUsers } from "../services/notification.service.js";
import { ApiError } from "../utils/ApiError.js";
import { created, ok } from "../utils/http.js";

/** Students never receive answers before submitting. */
function forStudent(quiz) {
  const json = quiz.toJSON();
  json.questions = json.questions.map(({ prompt, options, topic, difficulty, id }) => ({
    id,
    prompt,
    options,
    topic,
    difficulty,
  }));
  return json;
}

async function courseOf(courseId) {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("Course not found.");
  return course;
}

export async function listQuizzes(request, response) {
  const { courseId, status } = request.valid.query;
  const course = await courseOf(courseId);
  await assertCourseAccess(request.user, course);

  const isAdmin = request.user.role === "admin";
  const filter = { course: courseId };
  if (!isAdmin || !status) filter.status = "published";
  else if (status !== "all") filter.status = status;

  const quizzes = await Quiz.find(filter).sort({ createdAt: 1 });
  let best = new Map();
  if (!isAdmin && quizzes.length) {
    const rows = await QuizAttempt.aggregate([
      { $match: { student: request.user._id, quiz: { $in: quizzes.map((q) => q._id) } } },
      { $group: { _id: "$quiz", best: { $max: "$percent" }, attempts: { $sum: 1 } } },
    ]);
    best = new Map(rows.map((row) => [String(row._id), row]));
  }

  return ok(
    response,
    quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      lesson: quiz.lesson ? String(quiz.lesson) : null,
      status: quiz.status,
      source: quiz.source,
      questionCount: quiz.questions.length,
      bestPercent: best.get(quiz.id)?.best ?? null,
      attempts: best.get(quiz.id)?.attempts ?? 0,
    })),
  );
}

export async function getQuiz(request, response) {
  const quiz = await Quiz.findById(request.params.id);
  if (!quiz) throw ApiError.notFound("Quiz not found.");
  const isAdmin = request.user.role === "admin";
  if (!isAdmin && quiz.status !== "published") throw ApiError.notFound("Quiz not found.");
  await assertCourseAccess(request.user, await courseOf(quiz.course));
  return ok(response, { quiz: isAdmin ? quiz : forStudent(quiz) });
}

async function assertLessonInCourse(lessonId, courseId) {
  if (lessonId && !(await Lesson.exists({ _id: lessonId, course: courseId }))) {
    throw ApiError.badRequest("The lesson does not belong to this course.");
  }
}

export async function createQuiz(request, response) {
  const data = request.valid.body;
  await courseOf(data.course);
  await assertLessonInCourse(data.lesson, data.course);
  const quiz = await Quiz.create({
    ...data,
    status: data.status ?? "published",
    source: "manual",
    createdBy: request.user.id,
  });
  return created(response, { quiz }, "Quiz created.");
}

export async function updateQuiz(request, response) {
  const quiz = await Quiz.findById(request.params.id);
  if (!quiz) throw ApiError.notFound("Quiz not found.");
  Object.assign(quiz, request.valid.body);
  await quiz.save();
  return ok(response, { quiz }, { message: "Quiz updated." });
}

export async function deleteQuiz(request, response) {
  const quiz = await Quiz.findById(request.params.id);
  if (!quiz) throw ApiError.notFound("Quiz not found.");
  await Promise.all([QuizAttempt.deleteMany({ quiz: quiz._id }), quiz.deleteOne()]);
  return ok(response, { deleted: true, id: quiz.id }, { message: "Quiz deleted." });
}

export async function submitAttempt(request, response) {
  const quiz = await Quiz.findById(request.params.id);
  if (!quiz || quiz.status !== "published") throw ApiError.notFound("Quiz not found.");
  const course = await courseOf(quiz.course);
  await assertCourseAccess(request.user, course);

  const { answers } = request.valid.body;
  if (answers.length !== quiz.questions.length) {
    throw ApiError.badRequest(`Provide one answer per question (${quiz.questions.length}). Use -1 to skip.`);
  }

  const results = quiz.questions.map((question, index) => ({
    questionId: question._id,
    topic: question.topic,
    correct: answers[index] === question.answerIndex,
  }));
  const score = results.filter((item) => item.correct).length;
  const total = quiz.questions.length;
  const percent = Math.round((score / total) * 100);

  const attempt = await QuizAttempt.create({
    student: request.user.id,
    quiz: quiz._id,
    course: quiz.course,
    answers,
    score,
    total,
    percent,
    results,
  });
  await applyAttemptToMastery(request.user.id, quiz.course, results);

  await notifyUsers([request.user.id], {
    type: "quiz",
    title: "Quiz graded",
    body: `${quiz.title}: ${score}/${total} (${percent}%)`,
    link: `/courses/${course.slug}`,
  });

  // Correct answers and explanations are revealed only now that the attempt is recorded.
  const review = quiz.questions.map((question, index) => ({
    questionId: String(question._id),
    prompt: question.prompt,
    options: question.options,
    selectedIndex: answers[index],
    correctIndex: question.answerIndex,
    correct: results[index].correct,
    explanation: question.explanation,
    topic: question.topic,
  }));

  return created(response, { attempt: { id: attempt.id, score, total, percent }, review }, "Quiz submitted.");
}

export async function myAttempts(request, response) {
  const attempts = await QuizAttempt.find({ student: request.user.id, quiz: request.params.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .select("score total percent createdAt");
  return ok(response, attempts);
}

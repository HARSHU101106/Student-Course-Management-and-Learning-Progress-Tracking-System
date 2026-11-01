import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, createCourse, createUser } from "./helpers.js";

let ALPHA;
let PRIOR;
let nextMastery;

describe("enrollment, progress and quizzes", () => {
  let ctx;
  let admin;
  let student;
  let other;
  let course;
  let lessons;

  before(async () => {
    ctx = await boot({ name: "learning" });
    ({ ALPHA, PRIOR, nextMastery } = await import("../src/services/mastery.service.js"));
    admin = await createUser(ctx, { role: "admin" });
    student = await createUser(ctx);
    other = await createUser(ctx);
    ({ course, lessons } = await createCourse(ctx, {}, 4));
  });
  after(() => ctx.close());

  it("enrolls once, rejects duplicates, and sends a notification", async () => {
    const first = await ctx.request.post("/api/v1/enrollments").set(student.auth).send({ courseId: course.id });
    assert.equal(first.status, 201);
    const again = await ctx.request.post("/api/v1/enrollments").set(student.auth).send({ courseId: course.id });
    assert.equal(again.status, 409);
    const notes = await ctx.request.get("/api/v1/notifications").set(student.auth);
    assert.equal(notes.body.meta.unreadCount, 1);
    assert.equal(notes.body.data[0].type, "enrollment");
  });

  it("refuses enrollment in draft or unknown courses and for admins", async () => {
    const { course: draft } = await createCourse(ctx, { status: "draft" });
    assert.equal((await ctx.request.post("/api/v1/enrollments").set(other.auth).send({ courseId: draft.id })).status, 404);
    assert.equal((await ctx.request.post("/api/v1/enrollments").set(admin.auth).send({ courseId: course.id })).status, 403);
  });

  it("lists my courses with progress", async () => {
    const res = await ctx.request.get("/api/v1/enrollments/my-courses").set(student.auth);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].progress.totalLessons, 4);
    assert.equal(res.body.data[0].progress.percent, 0);
  });

  it("tracks lesson completion idempotently and computes percent", async () => {
    const mark = (lesson, body = {}) =>
      ctx.request.put(`/api/v1/progress/${course.id}/lessons/${lesson.id}`).set(student.auth).send(body);
    const a = await mark(lessons[0], { completed: true, positionSec: 42 });
    assert.equal(a.status, 200);
    assert.equal(a.body.data.progress.percent, 25);
    const dup = await mark(lessons[0], { completed: true });
    assert.equal(dup.body.data.progress.completedLessons, 1, "marking twice must not double count");
    const b = await mark(lessons[1]);
    assert.equal(b.body.data.progress.percent, 50);
    const undo = await mark(lessons[1], { completed: false });
    assert.equal(undo.body.data.progress.percent, 25);

    const detail = await ctx.request.get(`/api/v1/lessons/${lessons[0].id}`).set(student.auth);
    assert.equal(detail.body.data.completed, true);
    assert.equal(detail.body.data.resumeAtSec, 42);
  });

  it("blocks progress updates by non-enrolled students and for foreign lessons", async () => {
    const res = await ctx.request.put(`/api/v1/progress/${course.id}/lessons/${lessons[0].id}`).set(other.auth).send({});
    assert.equal(res.status, 403);
    const { lessons: foreign } = await createCourse(ctx);
    const wrong = await ctx.request.put(`/api/v1/progress/${course.id}/lessons/${foreign[0].id}`).set(student.auth).send({});
    assert.equal(wrong.status, 404);
  });

  it("completes the course at 100% and notifies the student", async () => {
    for (const lesson of lessons) {
      await ctx.request.put(`/api/v1/progress/${course.id}/lessons/${lesson.id}`).set(student.auth).send({});
    }
    const enrollment = await ctx.models.Enrollment.findOne({ student: student.user._id, course: course._id });
    assert.equal(enrollment.status, "completed");
    const notes = await ctx.request.get("/api/v1/notifications").set(student.auth);
    assert.ok(notes.body.data.some((n) => n.title === "Course completed"));
    const summary = await ctx.request.get("/api/v1/progress/summary").set(student.auth);
    assert.equal(summary.body.data.completed, 1);
    assert.equal(summary.body.data.averagePercent, 100);
  });

  it("records watch events only for enrolled courses", async () => {
    const { course: foreign, lessons: fl } = await createCourse(ctx);
    const res = await ctx.request.post("/api/v1/progress/watch").set(student.auth).send({
      events: [
        { courseId: course.id, lessonId: lessons[0].id, event: "heartbeat", positionSec: 10, deltaSec: 15 },
        { courseId: foreign.id, lessonId: fl[0].id, event: "heartbeat", positionSec: 5, deltaSec: 5 },
      ],
    });
    assert.equal(res.status, 202);
    assert.deepEqual(res.body.data, { accepted: 1, ignored: 1 });
    const progress = await ctx.models.LearningProgress.findOne({ student: student.user._id, course: course._id });
    assert.equal(progress.watchSeconds, 15);
  });

  it("saves the latest playback position from watch events so lessons can resume", async () => {
    await ctx.request.post("/api/v1/progress/watch").set(student.auth).send({
      events: [
        { courseId: course.id, lessonId: lessons[2].id, event: "heartbeat", positionSec: 61.9, deltaSec: 15 },
        { courseId: course.id, lessonId: lessons[2].id, event: "pause", positionSec: 90.2, deltaSec: 5 },
      ],
    });
    const detail = await ctx.request.get(`/api/v1/lessons/${lessons[2].id}`).set(student.auth);
    assert.equal(detail.body.data.resumeAtSec, 90);
  });

  describe("quizzes", () => {
    let quizId;
    before(async () => {
      const res = await ctx.request.post("/api/v1/quizzes").set(admin.auth).send({
        course: course.id,
        title: "Check",
        questions: [
          { prompt: "Q1?", options: ["a", "b", "c"], answerIndex: 1, explanation: "because b", topic: "Alpha" },
          { prompt: "Q2?", options: ["a", "b"], answerIndex: 0, explanation: "because a", topic: "Alpha" },
          { prompt: "Q3?", options: ["a", "b"], answerIndex: 1, explanation: "because b again", topic: "Beta" },
        ],
      });
      assert.equal(res.status, 201);
      quizId = res.body.data.quiz.id;
    });

    it("never leaks answers or explanations to students before they submit", async () => {
      const res = await ctx.request.get(`/api/v1/quizzes/${quizId}`).set(student.auth);
      assert.equal(res.status, 200);
      const text = JSON.stringify(res.body);
      assert.doesNotMatch(text, /answerIndex|because/);
      assert.equal(res.body.data.quiz.questions.length, 3);
    });

    it("validates answer arrays", async () => {
      const res = await ctx.request.post(`/api/v1/quizzes/${quizId}/attempts`).set(student.auth).send({ answers: [1] });
      assert.equal(res.status, 400);
    });

    it("grades on the server and reveals the review afterwards", async () => {
      const res = await ctx.request.post(`/api/v1/quizzes/${quizId}/attempts`).set(student.auth).send({ answers: [1, 1, 1] });
      assert.equal(res.status, 201);
      assert.deepEqual({ score: res.body.data.attempt.score, total: res.body.data.attempt.total, percent: res.body.data.attempt.percent }, { score: 2, total: 3, percent: 67 });
      assert.equal(res.body.data.review[1].correct, false);
      assert.equal(res.body.data.review[1].correctIndex, 0);
      assert.match(res.body.data.review[1].explanation, /because a/);
    });

    it("scores a blank submission as zero rather than 100%", async () => {
      const res = await ctx.request.post(`/api/v1/quizzes/${quizId}/attempts`).set(student.auth).send({ answers: [-1, -1, -1] });
      assert.equal(res.body.data.attempt.score, 0);
    });

    it("updates per-topic mastery using the documented formula", async () => {
      const rows = await ctx.models.TopicMastery.find({ student: student.user._id, course: course._id }).lean();
      const alpha = rows.find((r) => r.topic === "Alpha");
      // attempt 1: Q1 correct, Q2 wrong -> attempt 2: both wrong
      let expected = PRIOR;
      for (const correct of [true, false, false, false]) expected = nextMastery(expected, correct);
      assert.equal(alpha.score, expected);
      assert.equal(alpha.attempts, 4);
      assert.equal(alpha.correct, 1);
    });

    it("hides draft quizzes from students and stops non-enrolled students", async () => {
      const draft = await ctx.request.post("/api/v1/quizzes").set(admin.auth).send({
        course: course.id, title: "Draft", status: "draft",
        questions: [{ prompt: "Hidden?", options: ["y", "n"], answerIndex: 0 }],
      });
      const list = await ctx.request.get("/api/v1/quizzes").query({ courseId: course.id }).set(student.auth);
      assert.ok(list.body.data.every((quiz) => quiz.status === "published"));
      assert.equal((await ctx.request.get(`/api/v1/quizzes/${draft.body.data.quiz.id}`).set(student.auth)).status, 404);
      assert.equal((await ctx.request.get(`/api/v1/quizzes/${quizId}`).set(other.auth)).status, 403);
      assert.equal((await ctx.request.post(`/api/v1/quizzes/${quizId}/attempts`).set(other.auth).send({ answers: [0, 0, 0] })).status, 403);
    });

    it("rejects invalid question definitions", async () => {
      const res = await ctx.request.post("/api/v1/quizzes").set(admin.auth).send({
        course: course.id, title: "Broken", questions: [{ prompt: "Bad?", options: ["a", "b"], answerIndex: 5 }],
      });
      assert.equal(res.status, 400);
    });
  });

  it("unenrolls softly and allows re-enrolling with progress intact", async () => {
    const del = await ctx.request.delete(`/api/v1/enrollments/${course.id}`).set(student.auth);
    assert.equal(del.status, 200);
    assert.equal((await ctx.request.get(`/api/v1/lessons/${lessons[0].id}`).set(student.auth)).status, 403);
    const again = await ctx.request.post("/api/v1/enrollments").set(student.auth).send({ courseId: course.id });
    assert.equal(again.status, 201);
    const progress = await ctx.models.LearningProgress.findOne({ student: student.user._id, course: course._id });
    assert.equal(progress.completedLessons, 4);
  });
});

describe("mastery model (unit)", () => {
  it("moves toward the outcome by ALPHA and stays within [0, 1]", () => {
    assert.equal(nextMastery(0.5, true), Math.round((0.5 + ALPHA * 0.5) * 1000) / 1000);
    assert.equal(nextMastery(0.5, false), Math.round((0.5 - ALPHA * 0.5) * 1000) / 1000);
    let score = 0.5;
    for (let i = 0; i < 100; i += 1) score = nextMastery(score, true);
    assert.ok(score <= 1 && score > 0.99);
    for (let i = 0; i < 100; i += 1) score = nextMastery(score, false);
    assert.ok(score >= 0 && score < 0.01);
  });
});

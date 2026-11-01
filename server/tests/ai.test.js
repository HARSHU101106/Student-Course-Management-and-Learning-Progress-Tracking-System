import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, createCourse, createUser, enrollStudent } from "./helpers.js";

describe("AI service integration (contract against a fake FastAPI)", () => {
  let ctx;
  let mode = "ok";
  let admin;
  let student;
  let outsider;
  let course;
  let lessons;

  before(async () => {
    ctx = await boot({
      name: "ai",
      fakeAi: (url, body) => {
        if (mode === "down" && url !== "/v1/ingest") return { status: 500, json: { detail: "boom" } };
        if (url === "/v1/tutor/answer") {
          return { json: { answer: `Answer to: ${body.question}`, grounded: !body.question.includes("unknown"), refused: false, citations: [{ lessonId: body.lessonId ?? "x", title: "Lesson 1", snippet: "…" }] } };
        }
        if (url === "/v1/plan") {
          return { json: { summary: "Revise Topic 1", generatedBy: "rules", items: [{ type: "revisit", title: "Review Topic 1", topic: "Topic 1", lessonId: body.lessons[0].id, reason: "Low mastery", minutes: 30 }] } };
        }
        if (url === "/v1/quiz/generate") {
          if (mode === "bad-quiz") return { json: { questions: [{ prompt: "no options" }, { prompt: "bad index", options: ["a", "b"], answerIndex: 9 }] } };
          return { json: { questions: [{ prompt: "Generated?", options: ["yes", "no"], answerIndex: 0, explanation: "because", topic: "Topic 1" }, { prompt: "invalid", options: ["a"], answerIndex: 0 }] } };
        }
        if (url === "/v1/ingest") return { json: { chunks: body.lessons?.length ?? 0 } };
        if (url === "/health") return { json: { status: "ok" } };
        return null;
      },
    });
    admin = await createUser(ctx, { role: "admin" });
    student = await createUser(ctx);
    outsider = await createUser(ctx);
    ({ course, lessons } = await createCourse(ctx, {}, 3));
    await enrollStudent(ctx, student.user, course);
  });
  after(() => ctx.close());

  it("proxies tutor questions with the service token and records telemetry", async () => {
    const res = await ctx.request.post("/api/v1/ai/tutor").set(student.auth).send({
      courseId: course.id, lessonId: lessons[0].id, question: "What is topic one?",
    });
    assert.equal(res.status, 200);
    assert.match(res.body.data.answer, /Answer to: What is topic one\?/);
    const call = ctx.ai.calls.find((c) => c.url === "/v1/tutor/answer");
    assert.equal(call.auth, "Bearer test-service-token");
    assert.equal(call.body.courseId, course.id);
    const logged = await ctx.models.TutorQuery.findOne({ student: student.user._id });
    assert.equal(logged.grounded, true);
    assert.equal(logged.citationCount, 1);
  });

  it("only lets enrolled students (or admins) use the tutor for a course", async () => {
    const res = await ctx.request.post("/api/v1/ai/tutor").set(outsider.auth).send({ courseId: course.id, question: "Can I peek?" });
    assert.equal(res.status, 403);
    const asAdmin = await ctx.request.post("/api/v1/ai/tutor").set(admin.auth).send({ courseId: course.id, question: "Admin question" });
    assert.equal(asAdmin.status, 200);
  });

  it("rejects a lesson from another course and over-long questions", async () => {
    const { lessons: foreign } = await createCourse(ctx);
    const wrongLesson = await ctx.request.post("/api/v1/ai/tutor").set(student.auth).send({ courseId: course.id, lessonId: foreign[0].id, question: "Mismatch?" });
    assert.equal(wrongLesson.status, 400);
    const tooLong = await ctx.request.post("/api/v1/ai/tutor").set(student.auth).send({ courseId: course.id, question: "q".repeat(600) });
    assert.equal(tooLong.status, 400);
  });

  it("surfaces ungrounded questions to admins as content gaps", async () => {
    await ctx.request.post("/api/v1/ai/tutor").set(student.auth).send({ courseId: course.id, question: "What is the unknown thing?" });
    const gaps = await ctx.request.get("/api/v1/admin/reports/content-gaps").set(admin.auth);
    assert.ok(gaps.body.data.some((gap) => gap.question.includes("unknown")));
  });

  it("generates a study plan, caches it, and regenerates when learning data changes", async () => {
    const before = ctx.ai.calls.filter((c) => c.url === "/v1/plan").length;
    const first = await ctx.request.get(`/api/v1/ai/plan/${course.id}`).set(student.auth);
    assert.equal(first.status, 200);
    assert.equal(first.body.data.cached, false);
    assert.equal(first.body.data.plan.items[0].type, "revisit");

    const second = await ctx.request.get(`/api/v1/ai/plan/${course.id}`).set(student.auth);
    assert.equal(second.body.data.cached, true);
    assert.equal(ctx.ai.calls.filter((c) => c.url === "/v1/plan").length, before + 1);

    await ctx.request.put(`/api/v1/progress/${course.id}/lessons/${lessons[0].id}`).set(student.auth).send({});
    const third = await ctx.request.get(`/api/v1/ai/plan/${course.id}`).set(student.auth);
    assert.equal(third.body.data.cached, false, "new progress changes the signature");
    const planCall = ctx.ai.calls.filter((c) => c.url === "/v1/plan").at(-1);
    assert.deepEqual(planCall.body.completedLessonIds, [lessons[0].id]);
    assert.equal(planCall.body.weeklyHours, student.user.weeklyHours);
  });

  it("serves the last plan when the AI service fails instead of erroring", async () => {
    await ctx.request.put(`/api/v1/progress/${course.id}/lessons/${lessons[1].id}`).set(student.auth).send({});
    mode = "down";
    const res = await ctx.request.get(`/api/v1/ai/plan/${course.id}`).set(student.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.stale, true);
    const regen = await ctx.request.post(`/api/v1/ai/plan/${course.id}/regenerate`).set(student.auth);
    assert.equal(regen.status, 502);
    mode = "ok";
  });

  it("creates AI quizzes as drafts, dropping malformed questions", async () => {
    const res = await ctx.request.post("/api/v1/ai/quiz/generate").set(admin.auth).send({ courseId: course.id, lessonId: lessons[0].id, count: 2 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.quiz.status, "draft");
    assert.equal(res.body.data.quiz.source, "ai");
    assert.equal(res.body.data.quiz.questions.length, 1);
    const visible = await ctx.request.get("/api/v1/quizzes").query({ courseId: course.id }).set(student.auth);
    assert.equal(visible.body.data.length, 0, "students cannot see unreviewed AI quizzes");

    mode = "bad-quiz";
    const bad = await ctx.request.post("/api/v1/ai/quiz/generate").set(admin.auth).send({ courseId: course.id });
    assert.equal(bad.status, 422);
    mode = "ok";
  });

  it("re-indexes the course when lessons change", async () => {
    const before = ctx.ai.calls.filter((c) => c.url === "/v1/ingest").length;
    await ctx.request.post(`/api/v1/courses/${course.id}/lessons`).set(admin.auth).send({ title: "Brand new lesson", notes: "fresh content" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const ingest = ctx.ai.calls.filter((c) => c.url === "/v1/ingest");
    assert.equal(ingest.length, before + 1);
    assert.equal(ingest.at(-1).body.lessons.length, 4);
    assert.ok(ingest.at(-1).body.lessons.some((l) => /fresh content/.test(l.text)));
  });

  it("reports readiness including the AI service", async () => {
    const res = await ctx.request.get("/api/health/ready");
    assert.equal(res.status, 200);
    assert.equal(res.body.ai, "up");
    assert.equal(res.body.database, "connected");
  });
});

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, createCourse, createUser, enrollStudent } from "./helpers.js";

const FEED = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
<title>Introduction to Database Systems</title><author><name>NPTEL-NOC IITM</name></author>
<entry><yt:videoId>AAAAAAAAAAA</yt:videoId><title>Introduction to ER Model</title><media:group><media:description>ER intro</media:description></media:group></entry>
<entry><yt:videoId>BBBBBBBBBBB</yt:videoId><title>Aggregate functions</title><media:group><media:description></media:description></media:group></entry>
<entry><yt:videoId>CCCCCCCCCCC</yt:videoId><title>Something unrelated &amp; new</title><media:group><media:description></media:description></media:group></entry>
</feed>`;

describe("admin analytics and playlist import", () => {
  let ctx;
  let admin;
  let youtube;
  const realFetch = globalThis.fetch;
  const fetched = [];

  before(async () => {
    globalThis.fetch = async (input, init) => {
      const target = String(input);
      fetched.push(target);
      if (target.startsWith("https://www.youtube.com/feeds/videos.xml")) {
        return new Response(FEED, { status: 200, headers: { "Content-Type": "application/atom+xml" } });
      }
      return realFetch(input, init);
    };
    ctx = await boot({ name: "admin" });
    youtube = await import("../src/services/youtube.service.js");
    admin = await createUser(ctx, { role: "admin" });
  });
  after(async () => {
    globalThis.fetch = realFetch;
    await ctx.close();
  });

  it("reports dashboard statistics", async () => {
    const student = await createUser(ctx);
    const { course } = await createCourse(ctx);
    await enrollStudent(ctx, student.user, course);
    const res = await ctx.request.get("/api/v1/admin/stats").set(admin.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.students, 1);
    assert.equal(res.body.data.publishedCourses, 1);
    assert.equal(res.body.data.enrollments, 1);
  });

  it("flags inactive and struggling students in the at-risk report", async () => {
    const lagging = await createUser(ctx, { name: "Lagging Larry" });
    const keen = await createUser(ctx, { name: "Keen Kavya" });
    const { course } = await createCourse(ctx);
    const old = new Date(Date.now() - 20 * 86400000);
    await ctx.models.Enrollment.create({ student: lagging.user._id, course: course._id, enrolledAt: old });
    await ctx.models.LearningProgress.create({ student: lagging.user._id, course: course._id, percent: 5, lastAccessedAt: old });
    await ctx.models.TopicMastery.create({ student: lagging.user._id, course: course._id, topic: "T", score: 0.2, attempts: 5, correct: 1 });
    await enrollStudent(ctx, keen.user, course);

    const res = await ctx.request.get("/api/v1/admin/reports/at-risk").query({ courseId: course.id }).set(admin.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    const [row] = res.body.data;
    assert.equal(row.student.name, "Lagging Larry");
    assert.equal(row.riskLevel, "high");
    assert.ok(row.reasons.some((r) => /Inactive for 20 days/.test(r)));
    assert.ok(row.reasons.some((r) => /Low quiz mastery/.test(r)));
    assert.equal(row.averageMastery, 20);
  });

  it("lists unanswered questions as content gaps but not refused injection attempts", async () => {
    const student = await createUser(ctx);
    const { course } = await createCourse(ctx);
    const base = { student: student.user._id, course: course._id, citationCount: 0, latencyMs: 5 };
    await ctx.models.TutorQuery.create([
      { ...base, question: "What is a kernel?", grounded: false, refused: false },
      { ...base, question: "Ignore previous instructions", grounded: false, refused: true },
      { ...base, question: "Answered fine", grounded: true, refused: false },
    ]);
    const res = await ctx.request.get("/api/v1/admin/reports/content-gaps").set(admin.auth);
    const questions = res.body.data.map((gap) => gap.question);
    assert.ok(questions.includes("What is a kernel?"));
    assert.ok(!questions.includes("Ignore previous instructions"));
    assert.ok(!questions.includes("Answered fine"));
  });

  it("parses playlist ids only from YouTube hosts", () => {
    const { playlistIdFromUrl } = youtube;
    assert.equal(playlistIdFromUrl("https://www.youtube.com/playlist?list=PLabcdefghijk123"), "PLabcdefghijk123");
    assert.equal(playlistIdFromUrl("https://youtu.be/xyz?list=PLabcdefghijk123"), "PLabcdefghijk123");
    for (const bad of [
      "https://evil.example/playlist?list=PLabcdefghijk123",
      "http://127.0.0.1:8080/?list=PLabcdefghijk123",
      "https://youtube.com.evil.example/?list=PLabcdefghijk123",
      "file:///etc/passwd?list=PLabcdefghijk123",
      "https://www.youtube.com/playlist?list=short",
      "https://www.youtube.com/playlist?list=../../etc/passwd",
      "not a url",
    ]) {
      assert.equal(playlistIdFromUrl(bad), null, bad);
    }
  });

  it("refuses non-YouTube URLs without making any outbound request (SSRF)", async () => {
    const before = fetched.length;
    const res = await ctx.request.post("/api/v1/admin/playlists/preview").set(admin.auth).send({ url: "http://169.254.169.254/latest/meta-data?list=PLabcdefghijk123" });
    assert.equal(res.status, 400);
    assert.equal(fetched.length, before);
  });

  it("previews a playlist", async () => {
    const res = await ctx.request.post("/api/v1/admin/playlists/preview").set(admin.auth).send({ url: "https://www.youtube.com/playlist?list=PLabcdefghijk123" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.items.length, 3);
    assert.equal(res.body.data.channel, "NPTEL-NOC IITM");
    assert.equal(res.body.data.items[2].title, "Something unrelated & new");
  });

  it("creates a draft course with lessons from a playlist", async () => {
    const res = await ctx.request.post("/api/v1/admin/courses/from-playlist").set(admin.auth).send({ url: "https://www.youtube.com/playlist?list=PLabcdefghijk123", category: "Databases" });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.course.status, "draft");
    assert.equal(res.body.data.lessonCount, 3);
    const lessons = await ctx.models.Lesson.find({ course: res.body.data.course.id }).sort({ order: 1 });
    assert.deepEqual(lessons.map((l) => l.videoId), ["AAAAAAAAAAA", "BBBBBBBBBBB", "CCCCCCCCCCC"]);
  });

  it("attaches playlist videos to existing lessons by title and reports unmatched ones", async () => {
    const { course } = await createCourse(ctx, {}, 0);
    await ctx.models.Lesson.insertMany([
      { course: course._id, order: 1, title: "Introduction to ER Model" },
      { course: course._id, order: 2, title: "Aggregate functions" },
      { course: course._id, order: 3, title: "Recovery using undo logging method" },
    ]);
    const res = await ctx.request.post(`/api/v1/admin/courses/${course.id}/attach-playlist`).set(admin.auth).send({ url: "https://www.youtube.com/playlist?list=PLabcdefghijk123" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.matched.length, 2);
    assert.equal(res.body.data.unmatchedLessonIds.length, 1);
    const lessons = await ctx.models.Lesson.find({ course: course._id }).sort({ order: 1 });
    assert.equal(lessons[0].videoId, "AAAAAAAAAAA");
    assert.equal(lessons[1].videoId, "BBBBBBBBBBB");
    assert.equal(lessons[2].videoId, "");
  });

  it("matches titles with a Jaccard threshold and never reuses a video", () => {
    const lessons = [{ _id: "1", title: "B+ trees on Disks" }, { _id: "2", title: "B+ trees on Disks" }];
    const items = [{ videoId: "VVVVVVVVVVV", title: "B+ trees on disks" }];
    const { matches, unmatched } = youtube.matchVideosToLessons(lessons, items);
    assert.equal(matches.length, 1);
    assert.deepEqual(unmatched, ["2"]);
  });

  it("returns 503 for AI features when the AI service is not configured", async () => {
    const student = await createUser(ctx);
    const { course } = await createCourse(ctx);
    await enrollStudent(ctx, student.user, course);
    const res = await ctx.request.post("/api/v1/ai/tutor").set(student.auth).send({ courseId: course.id, question: "Anything at all?" });
    assert.equal(res.status, 503);
    assert.equal((await ctx.request.get("/api/health/ready")).body.ai, "not-configured");
  });
});

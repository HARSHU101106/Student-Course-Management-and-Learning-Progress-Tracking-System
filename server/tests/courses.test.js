import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, createCourse, createUser, enrollStudent } from "./helpers.js";

describe("students (admin CRUD)", () => {
  let ctx;
  let admin;
  before(async () => {
    ctx = await boot({ name: "students" });
    admin = await createUser(ctx, { role: "admin" });
  });
  after(() => ctx.close());

  it("creates, reads, updates, lists and deletes a student", async () => {
    const created = await ctx.request.post("/api/v1/students").set(admin.auth).send({
      name: "Test Student", email: "crud@example.com", password: "A-long-secure-password-1", department: "ECE",
    });
    assert.equal(created.status, 201);
    const id = created.body.data.student.id;

    const read = await ctx.request.get(`/api/v1/students/${id}`).set(admin.auth);
    assert.equal(read.body.data.student.department, "ECE");

    const updated = await ctx.request.put(`/api/v1/students/${id}`).set(admin.auth).send({ department: "CSE", isActive: false });
    assert.equal(updated.body.data.student.department, "CSE");
    assert.equal(updated.body.data.student.isActive, false);

    const list = await ctx.request.get("/api/v1/students").query({ q: "crud", status: "inactive" }).set(admin.auth);
    assert.equal(list.body.meta.total, 1);

    const del = await ctx.request.delete(`/api/v1/students/${id}`).set(admin.auth);
    assert.equal(del.status, 200);
    assert.equal((await ctx.request.get(`/api/v1/students/${id}`).set(admin.auth)).status, 404);
  });

  it("cascades deletion to the student's enrollments, progress and notifications", async () => {
    const student = await createUser(ctx);
    const { course } = await createCourse(ctx);
    await enrollStudent(ctx, student.user, course);
    await ctx.models.Notification.create({ user: student.user._id, title: "hi" });
    await ctx.request.delete(`/api/v1/students/${student.user.id}`).set(admin.auth);
    assert.equal(await ctx.models.Enrollment.countDocuments({ student: student.user._id }), 0);
    assert.equal(await ctx.models.Notification.countDocuments({ user: student.user._id }), 0);
  });

  it("paginates", async () => {
    for (let i = 0; i < 5; i += 1) await createUser(ctx);
    const page = await ctx.request.get("/api/v1/students?limit=2&page=2").set(admin.auth);
    assert.equal(page.body.data.length, 2);
    assert.equal(page.body.meta.page, 2);
    assert.ok(page.body.meta.pages >= 3);
  });
});

describe("courses and lessons", () => {
  let ctx;
  let admin;
  let student;
  before(async () => {
    ctx = await boot({ name: "courses" });
    admin = await createUser(ctx, { role: "admin" });
    student = await createUser(ctx);
  });
  after(() => ctx.close());

  const body = { title: "Operating Systems", description: "Processes, memory and scheduling.", category: "Computer Science", duration: 8, level: "Intermediate", tags: ["os"] };

  it("creates a draft course with a unique slug, then publishes it", async () => {
    const a = await ctx.request.post("/api/v1/courses").set(admin.auth).send(body);
    const b = await ctx.request.post("/api/v1/courses").set(admin.auth).send(body);
    assert.equal(a.status, 201);
    assert.equal(a.body.data.course.status, "draft");
    assert.equal(a.body.data.course.slug, "operating-systems");
    assert.equal(b.body.data.course.slug, "operating-systems-2");
    assert.equal((await ctx.request.get(`/api/v1/courses/${a.body.data.course.slug}`)).status, 404);

    const published = await ctx.request.put(`/api/v1/courses/${a.body.data.course.id}`).set(admin.auth).send({ status: "published" });
    assert.equal(published.status, 200);
    assert.equal((await ctx.request.get("/api/v1/courses/operating-systems")).status, 200);
  });

  it("notifies students when a course is published", async () => {
    const before = await ctx.models.Notification.countDocuments({ user: student.user._id });
    const created = await ctx.request.post("/api/v1/courses").set(admin.auth).send({ ...body, title: "Compilers", status: "published" });
    assert.equal(created.status, 201);
    assert.equal(await ctx.models.Notification.countDocuments({ user: student.user._id }), before + 1);
  });

  it("validates course input", async () => {
    const res = await ctx.request.post("/api/v1/courses").set(admin.auth).send({ title: "x", duration: -2 });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.length >= 2);
  });

  it("searches, filters and paginates the catalogue", async () => {
    await createCourse(ctx, { title: "Quantum Gardening", category: "Botany", level: "Advanced" });
    const search = await ctx.request.get("/api/v1/courses").query({ q: "quantum" });
    assert.equal(search.body.data.length, 1);
    const filtered = await ctx.request.get("/api/v1/courses").query({ category: "Botany", level: "Advanced" });
    assert.equal(filtered.body.meta.total, 1);
    assert.ok(filtered.body.meta.categories.includes("Botany"));
    const paged = await ctx.request.get("/api/v1/courses?limit=1&page=2");
    assert.equal(paged.body.data.length, 1);
  });

  it("adds, edits, orders and deletes lessons, keeping lessonCount in sync", async () => {
    const { course } = await createCourse(ctx, {}, 0);
    const add = (title) => ctx.request.post(`/api/v1/courses/${course.id}/lessons`).set(admin.auth).send({ title, notes: `Notes ${title}`, topics: ["T"] });
    const one = await add("First lesson");
    const two = await add("Second lesson");
    assert.equal(one.body.data.lesson.order, 1);
    assert.equal(two.body.data.lesson.order, 2);
    assert.equal((await ctx.models.Course.findById(course.id)).lessonCount, 2);

    const edit = await ctx.request.put(`/api/v1/courses/${course.id}/lessons/${one.body.data.lesson.id}`).set(admin.auth).send({ title: "Renamed", videoId: "dQw4w9WgXcQ" });
    assert.equal(edit.body.data.lesson.videoId, "dQw4w9WgXcQ");
    const badVideo = await ctx.request.put(`/api/v1/courses/${course.id}/lessons/${one.body.data.lesson.id}`).set(admin.auth).send({ videoId: "not-valid" });
    assert.equal(badVideo.status, 400);

    await ctx.request.delete(`/api/v1/courses/${course.id}/lessons/${two.body.data.lesson.id}`).set(admin.auth);
    assert.equal((await ctx.models.Course.findById(course.id)).lessonCount, 1);
  });

  it("only exposes lesson notes and video to enrolled students", async () => {
    const { course, lessons } = await createCourse(ctx);
    const outsider = await ctx.request.get(`/api/v1/lessons/${lessons[0].id}`).set(student.auth);
    assert.equal(outsider.status, 403);

    const detail = await ctx.request.get(`/api/v1/courses/${course.slug}`).set(student.auth);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.lessons[0].notes, undefined);

    await enrollStudent(ctx, student.user, course);
    const allowed = await ctx.request.get(`/api/v1/lessons/${lessons[1].id}`).set(student.auth);
    assert.equal(allowed.status, 200);
    assert.match(allowed.body.data.lesson.notes, /Notes for lesson 2/);
    assert.equal(allowed.body.data.previous.id, lessons[0].id);
    assert.equal(allowed.body.data.next.id, lessons[2].id);
  });

  it("cascades course deletion", async () => {
    const { course } = await createCourse(ctx);
    await enrollStudent(ctx, student.user, course);
    const res = await ctx.request.delete(`/api/v1/courses/${course.id}`).set(admin.auth);
    assert.equal(res.status, 200);
    assert.equal(await ctx.models.Lesson.countDocuments({ course: course._id }), 0);
    assert.equal(await ctx.models.Enrollment.countDocuments({ course: course._id }), 0);
  });
});

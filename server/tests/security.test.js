import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PASSWORD, boot, createCourse, createUser } from "./helpers.js";

describe("security hardening", () => {
  let ctx;
  let admin;
  let student;
  before(async () => {
    ctx = await boot({ name: "security" });
    admin = await createUser(ctx, { role: "admin" });
    student = await createUser(ctx);
  });
  after(() => ctx.close());

  it("blocks NoSQL operator injection in the login body", async () => {
    const res = await ctx.request.post("/api/v1/auth/login").send({ email: { $ne: "" }, password: { $ne: "" } });
    assert.equal(res.status, 400);
  });

  it("blocks operator injection in query strings", async () => {
    const res = await ctx.request.get("/api/v1/courses?category[$ne]=x");
    assert.equal(res.status, 400);
  });

  it("treats regex metacharacters in search as literal text (no ReDoS / injection)", async () => {
    await createCourse(ctx, { title: "Plain Title" });
    const res = await ctx.request.get("/api/v1/courses").query({ q: "(a+)+$" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });

  it("requires authentication on every protected route family", async () => {
    const routes = [
      ["get", "/api/v1/students"],
      ["get", "/api/v1/notifications"],
      ["get", "/api/v1/enrollments/my-courses"],
      ["get", "/api/v1/progress/my-progress"],
      ["get", "/api/v1/messages/rooms"],
      ["get", "/api/v1/admin/stats"],
      ["post", "/api/v1/admin/playlists/preview"],
      ["post", "/api/v1/ai/tutor"],
    ];
    for (const [method, path] of routes) {
      const res = await ctx.request[method](path);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path} should require auth`);
    }
  });

  it("forbids students from every admin route", async () => {
    const { course } = await createCourse(ctx);
    const routes = [
      ["get", "/api/v1/students"],
      ["post", "/api/v1/students"],
      ["put", `/api/v1/students/${student.user.id}`],
      ["delete", `/api/v1/students/${student.user.id}`],
      ["post", "/api/v1/courses"],
      ["put", `/api/v1/courses/${course.id}`],
      ["delete", `/api/v1/courses/${course.id}`],
      ["post", `/api/v1/courses/${course.id}/lessons`],
      ["get", "/api/v1/admin/stats"],
      ["get", "/api/v1/admin/reports/at-risk"],
      ["post", "/api/v1/admin/playlists/preview"],
      ["post", `/api/v1/admin/courses/${course.id}/attach-playlist`],
      ["post", "/api/v1/notifications/broadcast"],
      ["post", "/api/v1/ai/quiz/generate"],
      ["post", "/api/v1/quizzes"],
    ];
    for (const [method, path] of routes) {
      const res = await ctx.request[method](path).set(student.auth).send({});
      assert.equal(res.status, 403, `${method.toUpperCase()} ${path} should be admin-only`);
    }
  });

  it("rejects mass-assignment on student updates", async () => {
    const target = await createUser(ctx);
    const res = await ctx.request.put(`/api/v1/students/${target.user.id}`).set(admin.auth).send({ role: "admin" });
    assert.equal(res.status, 400);
    const fresh = await ctx.models.User.findById(target.user.id);
    assert.equal(fresh.role, "student");
  });

  it("does not expose admin accounts through the student endpoints", async () => {
    const res = await ctx.request.get(`/api/v1/students/${admin.user.id}`).set(admin.auth);
    assert.equal(res.status, 404);
  });

  it("returns security headers and hides the framework", async () => {
    const res = await ctx.request.get("/api/health");
    assert.equal(res.headers["x-powered-by"], undefined);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.ok(res.headers["content-security-policy"]);
    assert.ok(res.headers["x-request-id"]);
  });

  it("applies a CORS allow-list", async () => {
    const allowed = await ctx.request.get("/api/health").set("Origin", "http://localhost:5173");
    assert.equal(allowed.headers["access-control-allow-origin"], "http://localhost:5173");
    const denied = await ctx.request.get("/api/health").set("Origin", "https://evil.example");
    assert.equal(denied.headers["access-control-allow-origin"], undefined);
  });

  it("returns structured errors without leaking internals", async () => {
    const malformed = await ctx.request.post("/api/v1/auth/login").set("Content-Type", "application/json").send("{bad json");
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.success, false);
    assert.ok(malformed.body.requestId);
    assert.doesNotMatch(JSON.stringify(malformed.body), /SyntaxError|node_modules|at \w+/);

    const missing = await ctx.request.get("/api/v1/nothing-here");
    assert.equal(missing.status, 404);
    const badId = await ctx.request.get("/api/v1/students/not-an-id").set(admin.auth);
    assert.equal(badId.status, 400);
  });

  it("rejects oversized request bodies", async () => {
    const res = await ctx.request.post("/api/v1/auth/login").send({ email: "a@b.co", password: "x".repeat(400_000) });
    assert.equal(res.status, 413);
  });

  it("only lets admins list draft courses", async () => {
    await createCourse(ctx, { title: "Hidden Draft", status: "draft" });
    const anon = await ctx.request.get("/api/v1/courses?status=draft");
    assert.ok(anon.body.data.every((course) => course.status === "published"));
    const asAdmin = await ctx.request.get("/api/v1/courses?status=draft").set(admin.auth);
    assert.ok(asAdmin.body.data.some((course) => course.title === "Hidden Draft"));
  });

  it("keeps the unused-password-hash timing helper in place", async () => {
    const { DUMMY_HASH } = ctx.models;
    assert.match(DUMMY_HASH, /^\$2[aby]\$/);
    assert.ok(PASSWORD);
  });
});

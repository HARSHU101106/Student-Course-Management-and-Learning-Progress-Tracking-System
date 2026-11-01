import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PASSWORD, boot, createUser } from "./helpers.js";

describe("authentication", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ name: "auth" });
  });
  after(() => ctx.close());

  const register = (body) => ctx.request.post("/api/v1/auth/register").send(body);
  const login = (body) => ctx.request.post("/api/v1/auth/login").send(body);

  it("registers a student and never returns the password", async () => {
    const res = await register({ name: "Asha Rao", email: "Asha@Example.com", password: PASSWORD, department: "CSE" });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email, "asha@example.com");
    assert.equal(res.body.data.user.role, "student");
    assert.equal(res.body.data.user.password, undefined);
    const stored = await ctx.models.User.findOne({ email: "asha@example.com" }).select("+password");
    assert.notEqual(stored.password, PASSWORD);
    assert.match(stored.password, /^\$2[aby]\$/);
  });

  it("rejects duplicate emails with 409", async () => {
    const res = await register({ name: "Asha Again", email: "asha@example.com", password: PASSWORD });
    assert.equal(res.status, 409);
  });

  it("enforces the 12 character password policy", async () => {
    const res = await register({ name: "Weak Pass", email: "weak@example.com", password: "short" });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "VALIDATION_ERROR");
    assert.ok(res.body.details.some((d) => d.path === "password"));
  });

  it("does not allow self-assigning the admin role", async () => {
    const res = await register({ name: "Mallory", email: "mallory@example.com", password: PASSWORD, role: "admin" });
    assert.equal(res.status, 400);
    assert.equal(await ctx.models.User.exists({ email: "mallory@example.com" }), null);
  });

  it("logs in and returns a bearer token that unlocks /auth/me", async () => {
    const res = await login({ email: "asha@example.com", password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.tokenType, "Bearer");
    const me = await ctx.request.get("/api/v1/auth/me").set("Authorization", `Bearer ${res.body.data.token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, "asha@example.com");
  });

  it("gives the same generic error for a wrong password and an unknown email", async () => {
    const wrong = await login({ email: "asha@example.com", password: "wrong-password-123" });
    const unknown = await login({ email: "nobody@example.com", password: "wrong-password-123" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  it("rejects missing, malformed and tampered tokens", async () => {
    assert.equal((await ctx.request.get("/api/v1/auth/me")).status, 401);
    assert.equal((await ctx.request.get("/api/v1/auth/me").set("Authorization", "Bearer abc.def.ghi")).status, 401);
    const { token } = await createUser(ctx);
    const tampered = `${token.slice(0, -4)}AAAA`;
    assert.equal((await ctx.request.get("/api/v1/auth/me").set("Authorization", `Bearer ${tampered}`)).status, 401);
  });

  it("rejects a token signed with the wrong secret or the 'none' algorithm", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const { user } = await createUser(ctx);
    const forged = jwt.sign({ role: "admin" }, "another-secret-another-secret-12345", { subject: String(user.id), issuer: "adaptlearn-api", audience: "adaptlearn-client" });
    assert.equal((await ctx.request.get("/api/v1/auth/me").set("Authorization", `Bearer ${forged}`)).status, 401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: String(user.id), role: "admin" })).toString("base64url")}.`;
    assert.equal((await ctx.request.get("/api/v1/auth/me").set("Authorization", `Bearer ${none}`)).status, 401);
  });

  it("rejects expired tokens", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const { user } = await createUser(ctx);
    const expired = jwt.sign({ role: "student" }, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: -10, issuer: "adaptlearn-api", audience: "adaptlearn-client" });
    assert.equal((await ctx.request.get("/api/v1/auth/me").set("Authorization", `Bearer ${expired}`)).status, 401);
  });

  it("locks out deactivated users immediately, even with a valid token", async () => {
    const { user, auth } = await createUser(ctx);
    assert.equal((await ctx.request.get("/api/v1/auth/me").set(auth)).status, 200);
    await ctx.models.User.updateOne({ _id: user._id }, { isActive: false });
    assert.equal((await ctx.request.get("/api/v1/auth/me").set(auth)).status, 401);
    assert.equal((await login({ email: user.email, password: PASSWORD })).status, 401);
  });

  it("changing the password invalidates older tokens", async () => {
    const { user, auth } = await createUser(ctx);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const changed = await ctx.request.post("/api/v1/auth/change-password").set(auth).send({ currentPassword: PASSWORD, newPassword: "A-brand-new-password-9" });
    assert.equal(changed.status, 200);
    assert.equal((await ctx.request.get("/api/v1/auth/me").set(auth)).status, 401);
    const fresh = await ctx.request.get("/api/v1/auth/me").set("Authorization", `Bearer ${changed.body.data.token}`);
    assert.equal(fresh.status, 200);
    assert.equal((await login({ email: user.email, password: "A-brand-new-password-9" })).status, 200);
  });

  it("updates only whitelisted profile fields", async () => {
    const { auth } = await createUser(ctx);
    const ok = await ctx.request.put("/api/v1/profile").set(auth).send({ name: "New Name", weeklyHours: 10 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.user.weeklyHours, 10);
    const bad = await ctx.request.put("/api/v1/profile").set(auth).send({ role: "admin" });
    assert.equal(bad.status, 400);
  });
});

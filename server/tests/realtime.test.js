import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, createCourse, createUser, emitAck, enrollStudent, once } from "./helpers.js";

describe("real-time chat and notifications (Socket.IO)", () => {
  let ctx;
  let url;
  let admin;
  let alice;
  let bob;
  let carol; // not in any shared course
  let course;

  before(async () => {
    ctx = await boot({ name: "realtime" });
    url = await ctx.listen();
    admin = await createUser(ctx, { role: "admin", name: "Prof Admin" });
    alice = await createUser(ctx, { name: "Alice" });
    bob = await createUser(ctx, { name: "Bob" });
    carol = await createUser(ctx, { name: "Carol" });
    ({ course } = await createCourse(ctx));
    await enrollStudent(ctx, alice.user, course);
    await enrollStudent(ctx, bob.user, course);
  });
  after(() => ctx.close());

  const room = () => `course:${course.id}`;

  it("rejects connections without a token or with a bad token", async () => {
    await assert.rejects(ctx.connectSocket(url, undefined), /required|Unauthorized/i);
    await assert.rejects(ctx.connectSocket(url, "garbage.token.value"), /Invalid|expired|Unauthorized/i);
  });

  it("rejects connections for deactivated users", async () => {
    const gone = await createUser(ctx);
    await ctx.models.User.updateOne({ _id: gone.user._id }, { isActive: false });
    await assert.rejects(ctx.connectSocket(url, gone.token));
  });

  it("delivers a course-room message to a classmate and persists it", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    const b = await ctx.connectSocket(url, bob.token);
    assert.equal((await emitAck(a, "chat:join", { room: room() })).ok, true);
    assert.equal((await emitAck(b, "chat:join", { room: room() })).ok, true);

    const incoming = once(b, "chat:message");
    const ack = await emitAck(a, "chat:send", { room: room(), text: "Hello <b>class</b>" });
    assert.equal(ack.ok, true);
    const message = await incoming;
    assert.equal(message.text, "Hello <b>class</b>", "stored verbatim; the UI escapes on render");
    assert.equal(message.sender.name, "Alice");

    const history = await ctx.request.get(`/api/v1/messages/rooms/${room()}`).set(bob.auth);
    assert.equal(history.status, 200);
    assert.equal(history.body.data.at(-1).text, "Hello <b>class</b>");
    assert.equal(await ctx.models.Message.countDocuments({ room: room() }), 1);
  });

  it("does not let outsiders join, read, or post in a course room", async () => {
    const c = await ctx.connectSocket(url, carol.token);
    const join = await emitAck(c, "chat:join", { room: room() });
    assert.equal(join.ok, false);
    const send = await emitAck(c, "chat:send", { room: room(), text: "let me in" });
    assert.equal(send.ok, false);
    assert.equal((await ctx.request.get(`/api/v1/messages/rooms/${room()}`).set(carol.auth)).status, 403);
    assert.equal((await ctx.request.post("/api/v1/messages").set(carol.auth).send({ room: room(), text: "hi" })).status, 403);
  });

  it("does not broadcast room messages to sockets that never joined", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    const bobSocket = await ctx.connectSocket(url, bob.token); // connected but not joined
    await emitAck(a, "chat:join", { room: room() });
    let leaked = false;
    bobSocket.on("chat:message", () => (leaked = true));
    await emitAck(a, "chat:send", { room: room(), text: "only for the room" });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(leaked, false);
  });

  it("sends a direct message and pushes a live notification without any refresh", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    const b = await ctx.connectSocket(url, bob.token);
    const notification = once(b, "notification:new");
    const dm = once(b, "chat:message");

    const ack = await emitAck(a, "chat:send", { to: bob.user.id, text: "Want to study together?" });
    assert.equal(ack.ok, true);
    assert.equal((await dm).text, "Want to study together?");
    const pushed = await notification;
    assert.equal(pushed.type, "message");
    assert.equal(pushed.title, "New message from Alice");
  });

  it("coalesces repeated DMs into a single unread notification with a running count", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    await emitAck(a, "chat:send", { to: bob.user.id, text: "second" });
    await emitAck(a, "chat:send", { to: bob.user.id, text: "third" });
    const list = await ctx.request.get("/api/v1/notifications").set(bob.auth);
    const fromAlice = list.body.data.filter((n) => n.type === "message" && n.meta?.from === alice.user.id);
    assert.equal(fromAlice.length, 1);
    assert.equal(fromAlice[0].meta.count, 3);
    assert.match(fromAlice[0].title, /3 new messages from Alice/);
  });

  it("serves direct-message history only to the two participants", async () => {
    const mine = await ctx.request.get(`/api/v1/messages/dm/${bob.user.id}`).set(alice.auth);
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.length >= 3);
    // Carol asking for "dm with bob" gets a different (empty) room, never Alice's thread.
    const hers = await ctx.request.get(`/api/v1/messages/dm/${bob.user.id}`).set(carol.auth);
    assert.equal(hers.body.data.length, 0);
  });

  it("only allows messaging classmates and instructors", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    const toCarol = await emitAck(a, "chat:send", { to: carol.user.id, text: "hey stranger" });
    assert.equal(toCarol.ok, false);
    const toAdmin = await emitAck(a, "chat:send", { to: admin.user.id, text: "Question for the instructor" });
    assert.equal(toAdmin.ok, true);
    const self = await emitAck(a, "chat:send", { to: alice.user.id, text: "me" });
    assert.equal(self.ok, false);

    const contacts = await ctx.request.get("/api/v1/messages/contacts").set(alice.auth);
    const names = contacts.body.data.map((c) => c.name).sort();
    assert.deepEqual(names, ["Bob", "Prof Admin"]);
  });

  it("validates message payloads and strips control characters", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    assert.equal((await emitAck(a, "chat:send", { room: room(), text: "   " })).ok, false);
    assert.equal((await emitAck(a, "chat:send", { room: room(), text: "x".repeat(2001) })).ok, false);
    assert.equal((await emitAck(a, "chat:send", { text: "no target" })).ok, false);
    assert.equal((await emitAck(a, "chat:send", { room: room(), to: bob.user.id, text: "both" })).ok, false);
    await emitAck(a, "chat:join", { room: room() });
    const ok = await emitAck(a, "chat:send", { room: room(), text: "clean\u0000text\u0007" });
    assert.equal(ok.message.text, "cleantext");
  });

  it("relays typing indicators to other members of the room", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    const b = await ctx.connectSocket(url, bob.token);
    await emitAck(a, "chat:join", { room: room() });
    await emitAck(b, "chat:join", { room: room() });
    const typing = once(b, "chat:typing");
    a.emit("chat:typing", { room: room() });
    assert.equal((await typing).user.name, "Alice");
  });

  it("pushes notifications triggered by REST actions (enrollment) to a connected student", async () => {
    const { course: another } = await createCourse(ctx);
    const b = await ctx.connectSocket(url, carol.token);
    const pushed = once(b, "notification:new");
    const res = await ctx.request.post("/api/v1/enrollments").set(carol.auth).send({ courseId: another.id });
    assert.equal(res.status, 201);
    assert.equal((await pushed).type, "enrollment");
  });

  it("pushes admin announcements to connected students of that course only", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    const c = await ctx.connectSocket(url, carol.token);
    let carolGot = false;
    c.on("notification:new", (n) => n.type === "announcement" && (carolGot = true));
    const got = once(a, "notification:new");
    const res = await ctx.request.post("/api/v1/notifications/broadcast").set(admin.auth).send({ title: "Quiz tomorrow", courseId: course.id });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.recipients, 2);
    assert.equal((await got).title, "Quiz tomorrow");
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(carolGot, false);
  });

  it("marks notifications read over REST and over the socket", async () => {
    const list = await ctx.request.get("/api/v1/notifications?unread=true").set(bob.auth);
    assert.ok(list.body.meta.unreadCount > 0);
    const one = await ctx.request.patch(`/api/v1/notifications/${list.body.data[0].id}/read`).set(bob.auth);
    assert.equal(one.body.data.notification.read, true);
    const b = await ctx.connectSocket(url, bob.token);
    const res = await emitAck(b, "notifications:read-all", {});
    assert.equal(res.ok, true);
    const after = await ctx.request.get("/api/v1/notifications").set(bob.auth);
    assert.equal(after.body.meta.unreadCount, 0);
  });

  it("will not let one user read or delete another user's notification", async () => {
    const n = await ctx.models.Notification.create({ user: alice.user._id, title: "private" });
    assert.equal((await ctx.request.patch(`/api/v1/notifications/${n.id}/read`).set(bob.auth)).status, 404);
    assert.equal((await ctx.request.delete(`/api/v1/notifications/${n.id}`).set(bob.auth)).status, 404);
  });

  it("rate-limits message floods per socket", async () => {
    const a = await ctx.connectSocket(url, alice.token);
    await emitAck(a, "chat:join", { room: room() });
    const results = [];
    for (let i = 0; i < 30; i += 1) results.push(await emitAck(a, "chat:send", { room: room(), text: `flood ${i}` }));
    assert.ok(results.some((r) => r.ok === false && /too quickly/.test(r.error)));
    assert.ok(results.filter((r) => r.ok).length <= 20);
  });

  it("lists the rooms and DM threads a user can see", async () => {
    const res = await ctx.request.get("/api/v1/messages/rooms").set(alice.auth);
    assert.equal(res.body.data.courses.length, 1);
    assert.ok(res.body.data.direct.some((thread) => thread.partner.name === "Bob"));
  });
});

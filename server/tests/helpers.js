// Environment must be configured BEFORE any application module is imported (env.js freezes on load).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-123456";
process.env.BCRYPT_ROUNDS = "4";
process.env.RATE_LIMIT_MAX = "100000";
process.env.AUTH_RATE_LIMIT_MAX = "100000";
process.env.AI_RATE_LIMIT_MAX = "100000";
process.env.CLIENT_URL = "http://localhost:5173";

import http from "node:http";
import { io as ioClient } from "socket.io-client";
import supertest from "supertest";

const MONGO_BASE = process.env.MONGO_URI_TEST || "mongodb://127.0.0.1:27017";
export const PASSWORD = "Sup3r-secret-pass!";

/** Minimal stand-in for the FastAPI service so the proxy/contract can be tested without Python. */
export async function startFakeAi(handler) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const parsed = body ? JSON.parse(body) : undefined;
      calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: parsed });
      const result = handler(req.url, parsed, req.method) ?? { status: 404, json: { detail: "not found" } };
      res.writeHead(result.status ?? 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.json ?? {}));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function boot({ name, env = {}, fakeAi } = {}) {
  let ai;
  if (fakeAi) {
    ai = await startFakeAi(fakeAi);
    process.env.AI_SERVICE_URL = ai.url;
    process.env.AI_SERVICE_TOKEN = "test-service-token";
  }
  Object.assign(process.env, env, {
    MONGO_URI: `${MONGO_BASE}/adaptlearn_test_${name}_${process.pid}`,
  });

  const [{ createApp }, db, models, tokens, sockets] = await Promise.all([
    import("../src/app.js"),
    import("../src/config/db.js"),
    import("../src/models/index.js"),
    import("../src/services/token.service.js"),
    import("../src/sockets/index.js"),
  ]);
  const mongoose = (await import("mongoose")).default;
  await db.connectDatabase();
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).filter((m) => m?.init).map((m) => m.init()));

  const app = createApp();
  const request = supertest(app);

  let server;
  let io;
  async function listen() {
    server = http.createServer(app);
    io = sockets.createSocketServer(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }

  const sockets_ = [];
  async function connectSocket(url, token) {
    const socket = ioClient(url, { auth: { token }, transports: ["websocket"], reconnection: false, forceNew: true });
    sockets_.push(socket);
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return socket;
  }

  return {
    app,
    request,
    models,
    signToken: tokens.signToken,
    ai,
    listen,
    connectSocket,
    mongoose,
    async close() {
      sockets_.forEach((socket) => socket.close());
      io?.close();
      await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
      await mongoose.connection.dropDatabase();
      await db.disconnectDatabase();
      await ai?.close();
    },
  };
}

let counter = 0;
export async function createUser(ctx, { role = "student", name, email, password = PASSWORD, ...rest } = {}) {
  counter += 1;
  const user = await ctx.models.User.create({
    name: name ?? `${role} ${counter}`,
    email: email ?? `${role}${counter}.${Date.now()}@example.com`,
    password,
    role,
    ...rest,
  });
  return { user, token: ctx.signToken(user), auth: { Authorization: `Bearer ${ctx.signToken(user)}` } };
}

export async function createCourse(ctx, overrides = {}, lessonCount = 3) {
  counter += 1;
  const course = await ctx.models.Course.create({
    title: `Course ${counter}`,
    slug: `course-${counter}-${Date.now()}`,
    description: "A course used in automated tests.",
    category: "Testing",
    duration: 4,
    status: "published",
    ...overrides,
  });
  const lessons = await ctx.models.Lesson.insertMany(
    Array.from({ length: lessonCount }, (_, index) => ({
      course: course._id,
      order: index + 1,
      title: `Lesson ${index + 1}`,
      topics: [`Topic ${(index % 2) + 1}`],
      notes: `Notes for lesson ${index + 1} about topic ${(index % 2) + 1}.`,
    })),
  );
  await ctx.models.Course.updateOne({ _id: course._id }, { lessonCount: lessons.length });
  return { course: await ctx.models.Course.findById(course._id), lessons };
}

export async function enrollStudent(ctx, student, course) {
  return ctx.models.Enrollment.create({ student: student._id, course: course._id });
}

export const once = (emitter, event, timeout = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeout);
    emitter.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

export const emitAck = (socket, event, payload) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No ack for "${event}"`)), 4000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });

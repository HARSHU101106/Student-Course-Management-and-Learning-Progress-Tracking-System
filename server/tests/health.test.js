import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

async function withServer(testFn) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    await testFn(port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("GET /health returns a healthy status", async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("GET /api/courses returns available course metadata", async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/courses`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body.items));
  });
});

test("POST /api/admin/playlists/import rejects missing URLs", async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/playlists/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.message, /required/i);
  });
});

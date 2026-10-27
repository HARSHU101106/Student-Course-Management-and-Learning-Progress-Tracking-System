import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET ||= "test-secret-with-at-least-thirty-two-bytes";

const { default: app } = await import("../src/app.js");
const { createAdminAccount } = await import("../src/services/auth.service.js");

async function withServer(testFn) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    await testFn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("registration, login, JWT protection, and course CRUD work end to end", async () => {
  await withServer(async (baseUrl) => {
    const email = `student-${randomUUID()}@example.com`;
    const registration = {
      name: "Test Student",
      email,
      password: "securePassword123",
      department: "Computer Science",
    };
    const registerResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registration),
    });
    assert.equal(registerResponse.status, 201);
    const registered = await registerResponse.json();
    assert.equal(registered.message, "Student registered successfully");
    assert.equal(registered.student.email, email);
    assert.equal("password" in registered.student, false);
    assert.equal("passwordHash" in registered.student, false);

    const duplicateResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...registration, email: email.toUpperCase() }),
    });
    assert.equal(duplicateResponse.status, 409);

    const incorrectLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrongPassword123" }),
    });
    assert.equal(incorrectLogin.status, 401);

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: registration.password }),
    });
    assert.equal(loginResponse.status, 200);
    const login = await loginResponse.json();
    assert.equal(login.tokenType, "Bearer");
    assert.ok(login.token);
    assert.equal(login.student.id, registered.student.id);
    const tokenClaims = jwt.decode(login.token);
    assert.equal(tokenClaims.sub, registered.student.id);
    assert.equal(tokenClaims.email, email);
    assert.equal(tokenClaims.role, "student");
    assert.equal("password" in tokenClaims, false);
    assert.equal("passwordHash" in tokenClaims, false);

    const publicCourses = await fetch(`${baseUrl}/api/v1/courses`);
    assert.equal(publicCourses.status, 200);
    const courseList = await publicCourses.json();
    assert.ok(Array.isArray(courseList.items));
    const publicCourse = await fetch(
      `${baseUrl}/api/v1/courses/${courseList.items[0].id}`,
    );
    assert.equal(publicCourse.status, 200);

    const coursePayload = {
      title: "Test API course",
      description: "Course created during API tests.",
      category: "Testing",
    };
    const unauthorizedCreate = await fetch(`${baseUrl}/api/v1/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coursePayload),
    });
    assert.equal(unauthorizedCreate.status, 401);

    const invalidTokenCreate = await fetch(`${baseUrl}/api/v1/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer not-a-valid-jwt",
      },
      body: JSON.stringify(coursePayload),
    });
    assert.equal(invalidTokenCreate.status, 401);

    const unauthorizedUpdate = await fetch(
      `${baseUrl}/api/v1/courses/${courseList.items[0].id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Unauthorized update" }),
      },
    );
    assert.equal(unauthorizedUpdate.status, 401);

    const unauthorizedDelete = await fetch(
      `${baseUrl}/api/v1/courses/${courseList.items[0].id}`,
      { method: "DELETE" },
    );
    assert.equal(unauthorizedDelete.status, 401);

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.token}`,
    };
    const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: authHeaders,
    });
    assert.equal(meResponse.status, 200);
    assert.equal((await meResponse.json()).user.id, registered.student.id);

    const createResponse = await fetch(`${baseUrl}/api/v1/courses`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(coursePayload),
    });
    assert.equal(createResponse.status, 403);

    const adminEmail = `admin-${randomUUID()}@example.com`;
    const adminPassword = "a-strong-admin-password-123";
    await createAdminAccount({ email: adminEmail, password: adminPassword });
    const adminLoginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    assert.equal(adminLoginResponse.status, 200);
    const adminLogin = await adminLoginResponse.json();
    assert.equal(adminLogin.student.role, "admin");
    assert.equal(jwt.decode(adminLogin.token).role, "admin");
    const adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminLogin.token}`,
    };

    const courseUpdateByStudent = await fetch(
      `${baseUrl}/api/v1/courses/${courseList.items[0].id}`,
      {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ title: "Student update" }),
      },
    );
    assert.equal(courseUpdateByStudent.status, 403);
    const courseDeleteByStudent = await fetch(
      `${baseUrl}/api/v1/courses/${courseList.items[0].id}`,
      { method: "DELETE", headers: authHeaders },
    );
    assert.equal(courseDeleteByStudent.status, 403);

    const adminCreateResponse = await fetch(`${baseUrl}/api/v1/courses`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(coursePayload),
    });
    assert.equal(adminCreateResponse.status, 201);
    const course = await adminCreateResponse.json();

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/courses/${course.id}`,
      {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({ title: "Updated test course" }),
      },
    );
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).title, "Updated test course");

    const deleteResponse = await fetch(
      `${baseUrl}/api/v1/courses/${course.id}`,
      { method: "DELETE", headers: adminHeaders },
    );
    assert.equal(deleteResponse.status, 200);
    assert.equal((await deleteResponse.json()).deleted, true);
  });
});

test("registration validates required fields and password length", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student",
        email: "invalid-email",
        password: "short",
        department: "Computer Science",
      }),
    });
    assert.equal(response.status, 400);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

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

async function registerAndLogin(baseUrl, roleName = "Student") {
  const email = `${roleName.toLowerCase().replace(/\s+/g, "-")}-${randomUUID()}@example.com`;
  const password = "securePassword123";
  const registration = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: roleName,
      email,
      password,
      department: "Computer Science",
      role: "admin",
    }),
  });
  assert.equal(registration.status, 201);
  const registeredUser = await registration.json();
  assert.equal(registeredUser.student.role, "student");

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  return {
    user: body.student,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${body.token}`,
    },
  };
}

test("enrollment and learning progress are scoped to authenticated students", async () => {
  await withServer(async (baseUrl) => {
    const student = await registerAndLogin(baseUrl);
    const otherStudent = await registerAndLogin(baseUrl, "Other Student");
    const adminEmail = `admin-${randomUUID()}@example.com`;
    const adminPassword = "another-strong-admin-password";
    await createAdminAccount({ email: adminEmail, password: adminPassword });
    const adminLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const adminBody = await adminLogin.json();
    const adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminBody.token}`,
    };

    const coursesResponse = await fetch(`${baseUrl}/api/v1/courses`);
    const { items: courses } = await coursesResponse.json();
    const courseId = courses[0].id;

    const anonymousList = await fetch(
      `${baseUrl}/api/v1/enrollments/my-courses`,
    );
    assert.equal(anonymousList.status, 401);

    const adminEnroll = await fetch(`${baseUrl}/api/v1/enrollments`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ courseId }),
    });
    assert.equal(adminEnroll.status, 403);

    const enrollmentResponse = await fetch(`${baseUrl}/api/v1/enrollments`, {
      method: "POST",
      headers: student.headers,
      body: JSON.stringify({ courseId, studentId: otherStudent.user.id }),
    });
    assert.equal(enrollmentResponse.status, 201);
    const enrollment = (await enrollmentResponse.json()).enrollment;
    assert.equal(enrollment.studentId, student.user.id);

    const duplicateEnrollment = await fetch(
      `${baseUrl}/api/v1/enrollments`,
      {
        method: "POST",
        headers: student.headers,
        body: JSON.stringify({ courseId }),
      },
    );
    assert.equal(duplicateEnrollment.status, 409);

    const myCoursesResponse = await fetch(
      `${baseUrl}/api/v1/enrollments/my-courses`,
      { headers: student.headers },
    );
    const myCourses = await myCoursesResponse.json();
    assert.equal(myCourses.totalEnrollments, 1);
    assert.equal(myCourses.enrollments[0].course.id, courseId);

    const totalLessons = courses[0].items.length;
    const update = (headers, completedLessons) =>
      fetch(`${baseUrl}/api/v1/progress`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ courseId, completedLessons, totalLessons }),
      });

    const unauthenticatedProgress = await fetch(
      `${baseUrl}/api/v1/progress/my-progress`,
    );
    assert.equal(unauthenticatedProgress.status, 401);
    const adminProgress = await fetch(
      `${baseUrl}/api/v1/progress/my-progress`,
      { headers: adminHeaders },
    );
    assert.equal(adminProgress.status, 403);

    const invalidProgress = await update(student.headers, totalLessons + 1);
    assert.equal(invalidProgress.status, 400);

    const partialProgress = await update(student.headers, 2);
    assert.equal(partialProgress.status, 200);
    assert.equal(
      (await partialProgress.json()).progress.progressPercentage,
      Math.round((2 / totalLessons) * 100),
    );

    const otherStudentProgress = await update(otherStudent.headers, 1);
    assert.equal(otherStudentProgress.status, 403);

    const completedProgress = await update(student.headers, totalLessons);
    assert.equal(completedProgress.status, 200);
    assert.equal(
      (await completedProgress.json()).progress.progressPercentage,
      100,
    );

    const completedCoursesResponse = await fetch(
      `${baseUrl}/api/v1/enrollments/my-courses`,
      { headers: student.headers },
    );
    const completedCourses = await completedCoursesResponse.json();
    assert.equal(completedCourses.enrollments[0].status, "completed");

    const progressResponse = await fetch(
      `${baseUrl}/api/v1/progress/my-progress`,
      { headers: student.headers },
    );
    const progressBody = await progressResponse.json();
    assert.equal(progressBody.totalCourses, 1);
    assert.equal(progressBody.progress[0].progressPercentage, 100);
    assert.equal(progressBody.progress[0].status, "completed");

    const updateAfterCompletion = await update(student.headers, 3);
    assert.equal(updateAfterCompletion.status, 403);

    const unenrollResponse = await fetch(
      `${baseUrl}/api/v1/enrollments/${courseId}`,
      { method: "DELETE", headers: student.headers },
    );
    assert.equal(unenrollResponse.status, 200);
    const repeatedUnenroll = await fetch(
      `${baseUrl}/api/v1/enrollments/${courseId}`,
      { method: "DELETE", headers: student.headers },
    );
    assert.equal(repeatedUnenroll.status, 404);
  });
});

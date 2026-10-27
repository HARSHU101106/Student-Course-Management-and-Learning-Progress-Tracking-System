import { randomUUID } from "node:crypto";
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { enrollments, learningProgress } from "../data/learning.js";
import { findCourseById } from "./courses.js";

const router = Router();
const requireStudent = [requireAuth, requireRole("student")];

function getStudentEnrollments(studentId) {
  return enrollments.filter((item) => item.studentId === studentId);
}

router.get("/my-courses", ...requireStudent, (request, response) => {
  const studentEnrollments = getStudentEnrollments(request.user.id)
    .map((enrollment) => {
      const course = findCourseById(enrollment.courseId);
      return {
        ...enrollment,
        course: course ? { id: course.id, title: course.title } : null,
      };
    })
    .sort((left, right) => right.enrolledAt.localeCompare(left.enrolledAt));

  return response.json({
    message: "Enrolled courses fetched successfully",
    student: {
      id: request.user.id,
      name: request.user.name || request.user.email,
    },
    totalEnrollments: studentEnrollments.length,
    enrollments: studentEnrollments,
    items: studentEnrollments.map((item) => ({
      courseId: item.courseId,
      courseTitle: item.course?.title || item.courseTitle,
      status: item.status,
      progress: item.progress,
    })),
  });
});

router.get("/me", ...requireStudent, (request, response) => {
  const studentEnrollments = getStudentEnrollments(request.user.id);
  return response.json({
    student: {
      id: request.user.id,
      name: request.user.name || request.user.email,
    },
    items: studentEnrollments.map((item) => ({
      courseId: item.courseId,
      courseTitle: findCourseById(item.courseId)?.title || item.courseTitle,
      status: item.status,
      progress: item.progress,
    })),
  });
});

router.get("/", requireAuth, requireRole("admin"), (_request, response) => {
  return response.json({ items: enrollments });
});

router.post("/", ...requireStudent, (request, response) => {
  const { courseId } = request.body || {};
  if (typeof courseId !== "string" || !courseId.trim()) {
    return response.status(400).json({ message: "Course ID is required." });
  }

  const course = findCourseById(courseId.trim());
  if (!course) {
    return response.status(404).json({ message: "Course not found." });
  }

  const existing = enrollments.find(
    (item) =>
      item.courseId === course.id && item.studentId === request.user.id,
  );
  if (existing) {
    return response.status(409).json({
      message: "Student is already enrolled in this course.",
    });
  }

  const enrollment = {
    id: randomUUID(),
    courseId: course.id,
    studentId: request.user.id,
    courseTitle: course.title,
    status: "active",
    progress: 0,
    enrolledAt: new Date().toISOString(),
  };
  enrollments.push(enrollment);

  return response.status(201).json({
    message: "Course enrollment successful",
    enrollment,
  });
});

router.delete("/:courseId", ...requireStudent, (request, response) => {
  const index = enrollments.findIndex(
    (item) =>
      item.courseId === request.params.courseId &&
      item.studentId === request.user.id,
  );
  if (index === -1) {
    return response.status(404).json({
      message: "You are not enrolled in this course.",
    });
  }

  const [removed] = enrollments.splice(index, 1);
  learningProgress.delete(`${request.user.id}:${removed.courseId}`);
  return response.json({ message: "Successfully unenrolled from course." });
});

export default router;

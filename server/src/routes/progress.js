import { randomUUID } from "node:crypto";
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { enrollments, learningProgress } from "../data/learning.js";
import { findCourseById, findCourseContainingLesson } from "./courses.js";

const router = Router();
const requireStudent = [requireAuth, requireRole("student")];

function getCourseProgressKey(studentId, courseId) {
  return `${studentId}:${courseId}`;
}

function lessonCount(course) {
  return course.items?.length || Number(course.lessons) || 0;
}

function updateStudentProgress(studentId, courseId, completedLessons, totalLessons) {
  if (typeof courseId !== "string" || !courseId.trim()) {
    return {
      status: 400,
      body: { message: "Course ID is required." },
    };
  }

  const course = findCourseById(courseId);
  if (!course) {
    return { status: 404, body: { message: "Course not found." } };
  }

  const expectedLessons = lessonCount(course);
  if (
    !Number.isInteger(completedLessons) ||
    !Number.isInteger(totalLessons) ||
    expectedLessons < 1 ||
    totalLessons !== expectedLessons ||
    completedLessons < 0 ||
    completedLessons > totalLessons
  ) {
    return {
      status: 400,
      body: { message: "Enter valid completed and total lesson counts." },
    };
  }

  const enrollment = enrollments.find(
    (item) => item.studentId === studentId && item.courseId === courseId,
  );
  if (!enrollment || enrollment.status !== "active") {
    return {
      status: 403,
      body: { message: "You must be actively enrolled in this course." },
    };
  }

  const progress = {
    ...(learningProgress.get(getCourseProgressKey(studentId, courseId)) || {
      id: randomUUID(),
      studentId,
      courseId,
      createdAt: new Date().toISOString(),
    }),
    completedLessons,
    totalLessons,
    progressPercentage: Math.round((completedLessons / totalLessons) * 100),
    lastAccessedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  learningProgress.set(getCourseProgressKey(studentId, courseId), progress);

  enrollment.progress = progress.progressPercentage;
  if (progress.progressPercentage === 100) {
    enrollment.status = "completed";
  }

  return {
    status: 200,
    body: {
      message: "Learning progress updated successfully",
      progress,
    },
  };
}

function getStudentProgress(studentId) {
  return enrollments
    .filter((item) => item.studentId === studentId)
    .map((enrollment) => {
      const savedProgress = learningProgress.get(
        getCourseProgressKey(studentId, enrollment.courseId),
      );
      const course = findCourseById(enrollment.courseId);
      if (!course) return null;
      const progress = savedProgress || {
        id: null,
        studentId,
        courseId: enrollment.courseId,
        completedLessons: 0,
        totalLessons: lessonCount(course),
        progressPercentage: 0,
        lastAccessedAt: enrollment.enrolledAt,
        updatedAt: enrollment.enrolledAt,
      };
      return {
        ...progress,
        course: { id: course.id, title: course.title },
        status: enrollment.status,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sendProgressUpdate(request, response) {
  const { courseId, completedLessons, totalLessons } = request.body || {};
  const result = updateStudentProgress(
    request.user.id,
    courseId,
    completedLessons,
    totalLessons,
  );
  return response.status(result.status).json(result.body);
}

router.get("/my-progress", ...requireStudent, (request, response) => {
  const progress = getStudentProgress(request.user.id);
  return response.json({
    message: "Learning progress fetched successfully",
    totalCourses: progress.length,
    progress,
  });
});

router.get("/me", ...requireStudent, (request, response) => {
  const progress = getStudentProgress(request.user.id);
  return response.json({
    studentId: request.user.id,
    summary: {
      completed: progress.filter((item) => item.progressPercentage === 100).length,
      inProgress: progress.filter((item) => item.progressPercentage < 100).length,
      totalLessons: progress.reduce((total, item) => total + item.totalLessons, 0),
    },
    items: progress,
  });
});

router.put("/", ...requireStudent, sendProgressUpdate);

router.post("/watch", ...requireStudent, (request, response) => {
  const { events = [] } = request.body || {};
  if (!Array.isArray(events) || events.length === 0) {
    return response.status(400).json({ message: "At least one watch event is required." });
  }

  return response.status(202).json({ accepted: events.length });
});

router.get("/:courseId", ...requireStudent, (request, response) => {
  const course = findCourseById(request.params.courseId);
  const enrollment = enrollments.find(
    (item) =>
      item.studentId === request.user.id &&
      item.courseId === request.params.courseId,
  );
  if (!course || !enrollment) {
    return response.status(404).json({ message: "Course progress not found." });
  }

  const progress = learningProgress.get(
    getCourseProgressKey(request.user.id, request.params.courseId),
  );
  return response.json({
    courseId: request.params.courseId,
    completed: progress?.completedLessons ?? 0,
    progress: progress || null,
  });
});

router.post("/:courseId", ...requireStudent, (request, response) => {
  return sendProgressUpdate(
    {
      ...request,
      body: { ...request.body, courseId: request.params.courseId },
    },
    response,
  );
});

router.post("/lessons/:id/complete", ...requireStudent, (request, response) => {
  const course = findCourseContainingLesson(request.params.id);
  const lessonIndex = course?.items.findIndex(
    (item) => item.id === request.params.id,
  );
  if (!course || lessonIndex === undefined || lessonIndex < 0) {
    return response.status(404).json({ message: "Lesson not found." });
  }

  const result = updateStudentProgress(
    request.user.id,
    course.id,
    lessonIndex + 1,
    lessonCount(course),
  );
  return response.status(result.status).json({
    ...result.body,
    lessonId: request.params.id,
    completed: result.status === 200,
    percentage: result.body.progress?.progressPercentage,
  });
});

export default router;

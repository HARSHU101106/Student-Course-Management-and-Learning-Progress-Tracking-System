import { Router } from "express";

const router = Router();

const enrollments = [
  {
    id: "en-1",
    courseId: "dbms-101",
    studentId: "stu-1",
    courseTitle: "Database Management Systems",
    status: "active",
    progress: 0,
  },
  {
    id: "en-2",
    courseId: "ml-101",
    studentId: "stu-1",
    courseTitle: "Introduction to Machine Learning",
    status: "enrolled",
    progress: 0,
  },
];

router.get("/me", (_request, response) => {
  response.json({
    student: { id: "stu-1", name: "Ravi K." },
    items: enrollments,
  });
});

router.get("/", (_request, response) => {
  response.json({ items: enrollments });
});

router.post("/", (request, response) => {
  const { courseId, studentId, courseTitle } = request.body || {};
  if (!courseId) {
    return response.status(400).json({ message: "Course ID is required." });
  }

  const existing = enrollments.find((item) => item.courseId === courseId && item.studentId === (studentId || "stu-1"));
  if (existing) {
    return response.status(409).json({ message: "Student is already enrolled in this course." });
  }

  const enrollment = {
    id: `en-${Date.now()}`,
    courseId,
    studentId: studentId || "stu-1",
    courseTitle: courseTitle || "Imported course",
    status: "enrolled",
    progress: 0,
  };

  enrollments.push(enrollment);
  return response.status(201).json(enrollment);
});

export default router;

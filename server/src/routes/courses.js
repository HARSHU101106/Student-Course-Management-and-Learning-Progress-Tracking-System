import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { randomUUID } from "node:crypto";
import { enrollments, learningProgress } from "../data/learning.js";

const router = Router();

const sampleCourses = [
  {
    id: "dbms-101",
    title: "Database Management Systems",
    category: "Computer Science",
    level: "Intermediate",
    duration: "4 weeks",
    lessons: 5,
    accent: "coral",
    description: "Understand relational design, normalization, and SQL indexing fundamentals.",
    items: [
      { id: "l1", title: "Introduction to databases", videoId: "L6H3k3dFQ3U", description: "Why databases matter in modern systems." },
      { id: "l2", title: "Normalization", videoId: "eCkYk7B7f6o", description: "Learn 1NF, 2NF, and 3NF with examples." },
      { id: "l3", title: "SQL joins", videoId: "qJm0sZ5kQm0", description: "Master joins and relational algebra basics." },
      { id: "l4", title: "Indexes and query tuning", videoId: "Qx8D7B8gLAA", description: "Explore indexing strategies and performance tradeoffs." },
      { id: "l5", title: "Transactions and ACID", videoId: "dGH7kQY1d7A", description: "Understand consistency, isolation, and durable writes." },
    ],
  },
  {
    id: "ml-101",
    title: "Introduction to Machine Learning",
    category: "AI",
    level: "Beginner",
    duration: "3 weeks",
    lessons: 4,
    accent: "cyan",
    description: "Explore model types, learning objectives, and practical evaluation strategies.",
    items: [
      { id: "m1", title: "What is machine learning?", videoId: "Gv9_4yMHFAM", description: "An overview of ML workflows and objectives." },
      { id: "m2", title: "Decision trees", videoId: "J4Wdy0Wc_xQ", description: "Learn how trees split and classify examples." },
      { id: "m3", title: "Model evaluation", videoId: "eG8nA9vHY8U", description: "Measure accuracy, precision, recall, and bias." },
      { id: "m4", title: "Feature engineering", videoId: "0Mnsw4Kgn6M", description: "Prepare data that helps your models learn well." },
    ],
  },
];

export function findCourseById(courseId) {
  return sampleCourses.find((item) => item.id === courseId);
}

export function findCourseContainingLesson(lessonId) {
  return sampleCourses.find((course) =>
    course.items?.some((lesson) => lesson.id === lessonId),
  );
}

router.get("/", (_request, response) => {
  response.json({
    success: true,
    count: sampleCourses.length,
    data: sampleCourses,
    items: sampleCourses,
  });
});

router.get("/:id", (request, response) => {
  const course = sampleCourses.find((item) => item.id === request.params.id);
  if (!course) {
    return response.status(404).json({ message: "Course not found." });
  }
  return response.json(course);
});

router.get("/:id/lessons", (request, response) => {
  const course = sampleCourses.find((item) => item.id === request.params.id);
  if (!course) {
    return response.status(404).json({ message: "Course not found." });
  }

  return response.json({ items: course.items || [] });
});

router.post("/", requireAuth, requireRole("admin"), (request, response) => {
  const { title, description, category } = request.body || {};
  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof category !== "string" ||
    !title.trim() ||
    !description.trim() ||
    !category.trim()
  ) {
    return response.status(400).json({ message: "Title, description, and category are required." });
  }

  const course = {
    id: randomUUID(),
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    items: [],
    lessons: 0,
    level: "Beginner",
    duration: "1 week",
  };

  sampleCourses.push(course);
  return response.status(201).json(course);
});

router.put("/:id", requireAuth, requireRole("admin"), (request, response) => {
  const index = sampleCourses.findIndex((item) => item.id === request.params.id);
  if (index === -1) {
    return response.status(404).json({ message: "Course not found." });
  }

  const allowedFields = [
    "title",
    "description",
    "category",
    "level",
    "duration",
    "lessons",
    "accent",
  ];
  const updates = Object.fromEntries(
    allowedFields
      .filter((field) => Object.hasOwn(request.body || {}, field))
      .map((field) => [field, request.body[field]]),
  );
  if (!Object.keys(updates).length) {
    return response.status(400).json({ message: "At least one course field is required." });
  }
  for (const field of ["title", "description", "category"]) {
    if (field in updates && (typeof updates[field] !== "string" || !updates[field].trim())) {
      return response.status(400).json({ message: `${field} must be a non-empty string.` });
    }
    if (field in updates) updates[field] = updates[field].trim();
  }
  for (const field of ["level", "duration", "accent"]) {
    if (field in updates && typeof updates[field] !== "string") {
      return response.status(400).json({ message: `${field} must be a string.` });
    }
  }
  if (
    "lessons" in updates &&
    (!Number.isInteger(updates.lessons) || updates.lessons < 0)
  ) {
    return response.status(400).json({
      message: "lessons must be a non-negative integer.",
    });
  }

  const course = { ...sampleCourses[index], ...updates };
  sampleCourses[index] = course;
  return response.json(course);
});

router.delete("/:id", requireAuth, requireRole("admin"), (request, response) => {
  const index = sampleCourses.findIndex((item) => item.id === request.params.id);
  if (index === -1) {
    return response.status(404).json({ message: "Course not found." });
  }

  const [removed] = sampleCourses.splice(index, 1);
  for (let enrollmentIndex = enrollments.length - 1; enrollmentIndex >= 0; enrollmentIndex -= 1) {
    if (enrollments[enrollmentIndex].courseId === removed.id) {
      enrollments.splice(enrollmentIndex, 1);
    }
  }
  for (const key of learningProgress.keys()) {
    if (key.endsWith(`:${removed.id}`)) learningProgress.delete(key);
  }
  return response.json({ deleted: true, course: removed });
});

export default router;

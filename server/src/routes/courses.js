import { Router } from "express";

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

router.get("/", (_request, response) => {
  response.json({ items: sampleCourses });
});

router.get("/:id", (request, response) => {
  const course = sampleCourses.find((item) => item.id === request.params.id);
  if (!course) {
    return response.status(404).json({ message: "Course not found." });
  }
  return response.json(course);
});

export default router;

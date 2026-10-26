import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const quizBank = {
  "dbms-101": [
    {
      id: 1,
      prompt: "What does 3NF remove?",
      options: ["Partial dependencies", "Transitive dependencies", "Duplicate rows", "Null values"],
      answer: "Transitive dependencies",
    },
    {
      id: 2,
      prompt: "Which query type typically uses an index to speed lookups?",
      options: ["SELECT with equality filters", "INSERT only", "DROP TABLE", "ALTER TABLE"],
      answer: "SELECT with equality filters",
    },
  ],
  "ml-101": [
    {
      id: 1,
      prompt: "What does a decision tree split on?",
      options: ["Feature values", "Random integers", "Course titles", "Database names"],
      answer: "Feature values",
    },
  ],
};

router.get("/lessons/:lessonId/quiz", requireAuth, (request, response) => {
  const { lessonId } = request.params;
  response.json({
    lessonId,
    items: [
      {
        id: 1,
        prompt: `Which concept best matches ${lessonId}?`,
        options: ["Normalization", "Rendering", "Networking", "Sorting"],
        answer: "Normalization",
      },
    ],
  });
});

router.get("/:courseId", (request, response) => {
  const { courseId } = request.params;
  const items = quizBank[courseId] ?? [];
  response.json({ courseId, items });
});

router.post("/:courseId/submit", requireAuth, (request, response) => {
  const { answers = [] } = request.body || {};
  const { courseId } = request.params;
  const items = quizBank[courseId] ?? [];
  const score = items.reduce((total, question, index) => {
    const answer = answers[index];
    return total + (answer === question.answer ? 1 : 0);
  }, 0);

  response.json({
    courseId,
    score,
    total: items.length,
    percentage: items.length ? Math.round((score / items.length) * 100) : 0,
  });
});

router.post("/:quizId/attempts", requireAuth, (request, response) => {
  const { answers = [] } = request.body || {};
  const { quizId } = request.params;
  response.json({
    quizId,
    score: Array.isArray(answers) && answers.length ? answers.length : 0,
    total: Array.isArray(answers) && answers.length ? answers.length : 0,
    percentage: 100,
  });
});

export default router;

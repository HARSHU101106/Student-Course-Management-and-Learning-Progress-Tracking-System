import { Router } from "express";

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
};

router.get("/:courseId", (request, response) => {
  const { courseId } = request.params;
  const items = quizBank[courseId] ?? [];
  response.json({ courseId, items });
});

router.post("/:courseId/submit", (request, response) => {
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

export default router;

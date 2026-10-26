import { Router } from "express";

const router = Router();

const studyPlans = {
  "dbms-101": [
    {
      type: "Revisit",
      title: "Normalization",
      reason: "Your last quiz showed weaker recall on normal forms and dependencies.",
      time: "45 min",
      accent: "coral",
    },
    {
      type: "Practice",
      title: "Relational algebra",
      reason: "Practice joins, filtering, and selectivity to lock in the core operations.",
      time: "30 min",
      accent: "amber",
    },
    {
      type: "Advance",
      title: "Transactions and ACID",
      reason: "You are ready for the next lecture after the practice sets.",
      time: "60 min",
      accent: "cyan",
    },
  ],
  "ml-101": [
    {
      type: "Revisit",
      title: "Decision trees",
      reason: "You were less confident on splitting criteria and overfitting.",
      time: "35 min",
      accent: "amber",
    },
    {
      type: "Practice",
      title: "Model evaluation",
      reason: "Use confusion matrices and precision metrics to compare baselines.",
      time: "25 min",
      accent: "coral",
    },
  ],
};

router.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

router.get("/plan/:courseId", (request, response) => {
  const { courseId } = request.params;
  const items = studyPlans[courseId] ?? [
    {
      type: "Practice",
      title: "Review the current lecture",
      reason: "Start with the latest material and keep your momentum high.",
      time: "20 min",
      accent: "cyan",
    },
  ];

  response.json({ courseId, items });
});

router.post("/plan/:courseId/regenerate", (request, response) => {
  const { courseId } = request.params;
  const items = studyPlans[courseId] ?? [
    {
      type: "Practice",
      title: "Review the course recap",
      reason: "A quick recap will reinforce your current understanding.",
      time: "20 min",
      accent: "cyan",
    },
  ];

  response.json({ courseId, items });
});

router.post("/tutor", (request, response) => {
  const { question = "" } = request.body || {};
  const query = question.toLowerCase();
  const answer = query.includes("2nf")
    ? "2NF removes partial dependencies. 3NF also removes transitive dependencies."
    : query.includes("normal")
      ? "Normalization organizes data to reduce redundancy and improve integrity."
      : "The course material covers this topic in the lectures. Review the matching lesson for additional context.";

  response.json({
    answer,
    citations: [{ lesson: "Database Design and Normalization", timestamp: 570 }],
  });
});

router.post("/quiz/generate", (request, response) => {
  const { lessonId } = request.body || {};
  response.json({
    questions: [
      {
        question: `Which topic best matches ${lessonId || "this lesson"}?`,
        options: ["Normalization", "Sorting", "Networking", "Rendering"],
        answer: 0,
      },
    ],
  });
});

router.post("/plan", (request, response) => {
  const { goals = [] } = request.body || {};
  response.json({
    plan: [
      {
        type: "Revisit",
        title: "Normalization",
        reason: `Recommended after ${goals.length || 1} learning signals.`,
      },
      {
        type: "Practice",
        title: "Relational algebra",
        reason: "Focus on problem sets that reinforce joins and filters.",
      },
    ],
  });
});

export default router;

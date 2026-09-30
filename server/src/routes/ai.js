import { Router } from "express";

const router = Router();

router.get("/health", (_request, response) => {
  response.json({ status: "ok" });
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

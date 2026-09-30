import { Router } from "express";

const router = Router();
const progress = new Map();

router.get("/:courseId", (request, response) => {
  const { courseId } = request.params;
  response.json({ courseId, completed: progress.get(courseId) ?? [] });
});

router.post("/:courseId", (request, response) => {
  const { completed = [] } = request.body || {};
  const { courseId } = request.params;
  const next = [...new Set(completed.map(Number))].sort((a, b) => a - b);
  progress.set(courseId, next);
  response.json({ courseId, completed: next });
});

export default router;

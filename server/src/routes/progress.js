import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const progress = new Map();

router.get("/me", requireAuth, (_request, response) => {
  response.json({
    studentId: "stu-1",
    summary: {
      completed: 4,
      inProgress: 2,
      totalLessons: 10,
    },
    items: [],
  });
});

router.get("/:courseId", requireAuth, (request, response) => {
  const { courseId } = request.params;
  response.json({ courseId, completed: progress.get(courseId) ?? [] });
});

router.post("/:courseId", requireAuth, (request, response) => {
  const { completed = [] } = request.body || {};
  const { courseId } = request.params;
  const next = [...new Set(completed.filter((value) => Number.isFinite(Number(value))).map(Number))].sort((a, b) => a - b);
  progress.set(courseId, next);
  response.json({ courseId, completed: next });
});

router.post("/lessons/:id/complete", requireAuth, (request, response) => {
  const { id } = request.params;
  response.json({ lessonId: id, completed: true, percentage: 100 });
});

router.post("/watch", requireAuth, (request, response) => {
  const { events = [] } = request.body || {};
  if (!Array.isArray(events) || events.length === 0) {
    return response.status(400).json({ message: "At least one watch event is required." });
  }

  const accepted = events.length;
  return response.status(202).json({ accepted });
});

export default router;

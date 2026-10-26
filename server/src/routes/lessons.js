import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const lessons = [
  {
    id: "lesson-1",
    title: "Lecture 1",
    duration: "14 min",
    summary: "An introduction to the core concepts and vocabulary for this module.",
  },
  {
    id: "lesson-2",
    title: "Lecture 2",
    duration: "19 min",
    summary: "A deeper look at application patterns and reinforcement methods.",
  },
  {
    id: "dbms-101-l1",
    title: "Introduction to databases",
    duration: "18 min",
    summary: "Why databases matter in modern systems and how schemas support them.",
  },
];

router.get("/", (_request, response) => {
  response.json({ items: lessons });
});

router.get("/:id", (request, response) => {
  const lesson =
    lessons.find((item) => item.id === request.params.id) ?? {
      id: request.params.id,
      title: "Lecture preview",
      duration: "18 min",
      summary: "A sample lesson object for the learning experience.",
    };

  response.json(lesson);
});

router.get("/:id/quiz", requireAuth, (request, response) => {
  const lessonId = request.params.id;
  response.json({
    lessonId,
    items: [
      {
        id: 1,
        prompt: `Which concept is most relevant to ${lessonId}?`,
        options: ["Normalization", "UI routing", "Caching", "Networking"],
        answer: "Normalization",
      },
    ],
  });
});

export default router;

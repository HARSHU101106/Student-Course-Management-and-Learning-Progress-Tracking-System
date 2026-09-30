import { Router } from "express";

const router = Router();

router.get("/", (_request, response) => {
  response.json({
    items: [
      { id: "lesson-1", title: "Lecture 1", duration: "14 min" },
      { id: "lesson-2", title: "Lecture 2", duration: "19 min" },
    ],
  });
});

router.get("/:id", (request, response) => {
  response.json({
    id: request.params.id,
    title: "Lecture preview",
    duration: "18 min",
    summary: "A sample lesson object for the learning experience.",
  });
});

export default router;

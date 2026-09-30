import { Router } from "express";

const router = Router();

router.get("/", (_request, response) => {
  response.json({ items: [{ id: "en-1", courseId: "dbms-101", studentId: "stu-1" }] });
});

export default router;

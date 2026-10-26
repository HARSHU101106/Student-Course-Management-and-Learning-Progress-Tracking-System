import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const students = [
  { id: "stu-1", name: "Ravi K.", mastery: 31, lastActive: "9 days ago" },
  { id: "stu-2", name: "Sneha P.", mastery: 38, lastActive: "6 days ago" },
  { id: "stu-3", name: "Neha S.", mastery: 56, lastActive: "2 days ago" },
];

router.get("/", (_request, response) => {
  response.json({ items: students });
});

router.get("/:id", (request, response) => {
  const student = students.find((item) => item.id === request.params.id);
  if (!student) {
    return response.status(404).json({ message: "Student not found." });
  }

  return response.json(student);
});

router.put("/:id", requireAuth, requireRole("admin"), (request, response) => {
  const student = students.find((item) => item.id === request.params.id);
  if (!student) {
    return response.status(404).json({ message: "Student not found." });
  }

  Object.assign(student, request.body || {});
  return response.json(student);
});

router.delete("/:id", requireAuth, requireRole("admin"), (request, response) => {
  const index = students.findIndex((item) => item.id === request.params.id);
  if (index === -1) {
    return response.status(404).json({ message: "Student not found." });
  }

  const [removed] = students.splice(index, 1);
  return response.json({ deleted: true, student: removed });
});

export default router;

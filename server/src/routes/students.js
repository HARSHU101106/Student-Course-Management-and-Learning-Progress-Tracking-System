import { Router } from "express";

const router = Router();

router.get("/", (_request, response) => {
  response.json({
    items: [
      { id: "stu-1", name: "Ravi K.", mastery: 31, lastActive: "9 days ago" },
      { id: "stu-2", name: "Sneha P.", mastery: 38, lastActive: "6 days ago" },
    ],
  });
});

export default router;

import { Router } from "express";

const router = Router();

router.post("/login", (request, response) => {
  const { email, password } = request.body || {};
  if (!email || !password) {
    return response.status(400).json({ message: "Email and password are required." });
  }

  return response.json({
    user: {
      id: "demo-student",
      name: email.split("@")[0].replace(/[._-]/g, " ") || "Student",
      email,
      role: email.toLowerCase().startsWith("admin@") ? "admin" : "student",
    },
    token: "demo-token",
  });
});

router.post("/register", (request, response) => {
  const { name, email, password } = request.body || {};
  if (!name || !email || !password) {
    return response.status(400).json({ message: "Name, email, and password are required." });
  }

  return response.status(201).json({
    user: {
      id: "demo-new-user",
      name,
      email,
      role: email.toLowerCase().startsWith("admin@") ? "admin" : "student",
    },
    token: "demo-token",
  });
});

export default router;

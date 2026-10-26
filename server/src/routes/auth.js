import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", (request, response) => {
  const { email, password } = request.body || {};
  if (!email || !password) {
    return response.status(400).json({ message: "Email and password are required." });
  }

  const role = email.toLowerCase().startsWith("admin@") ? "admin" : "student";
  const token = role === "admin" ? "admin-demo-token" : "demo-token";

  return response.json({
    user: {
      id: role === "admin" ? "demo-admin" : "demo-student",
      name: email.split("@")[0].replace(/[._-]/g, " ") || "Student",
      email,
      role,
    },
    token,
  });
});

router.post("/register", (request, response) => {
  const { name, email, password } = request.body || {};
  if (!name || !email || !password) {
    return response.status(400).json({ message: "Name, email, and password are required." });
  }

  const role = email.toLowerCase().startsWith("admin@") ? "admin" : "student";

  return response.status(201).json({
    user: {
      id: "demo-new-user",
      name,
      email,
      role,
    },
    token: role === "admin" ? "admin-demo-token" : "demo-token",
  });
});

router.get("/me", requireAuth, (request, response) => {
  return response.json({
    user: {
      id: request.user.id,
      email: request.user.email,
      role: request.user.role,
      name: request.user.role === "admin" ? "Demo Admin" : "Demo Student",
    },
  });
});

export default router;

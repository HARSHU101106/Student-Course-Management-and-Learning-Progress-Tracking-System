import express from "express";
import cors from "./config/cors.js";
import adminRoutes from "./routes/admin.js";
import aiRoutes from "./routes/ai.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import enrollmentRoutes from "./routes/enrollments.js";
import lessonRoutes from "./routes/lessons.js";
import notificationRoutes from "./routes/notifications.js";
import progressRoutes from "./routes/progress.js";
import quizRoutes from "./routes/quizzes.js";
import studentRoutes from "./routes/students.js";

const app = express();
app.use(cors);
app.use(express.json());

app.get("/health", (_request, response) => response.json({ status: "ok" }));
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/students", studentRoutes);

app.use((request, response) => {
  response.status(404).json({ message: `Route not found: ${request.method} ${request.originalUrl}` });
});

app.use((error, _request, response, _next) => {
  const message = error?.message || "Internal server error";
  response.status(error?.statusCode || error?.status || 500).json({ message });
});

export default app;

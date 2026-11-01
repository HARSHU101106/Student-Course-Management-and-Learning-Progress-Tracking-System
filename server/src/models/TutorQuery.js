import mongoose from "mongoose";

/** Telemetry for the AI tutor. Ungrounded questions reveal gaps in course content. */
const tutorQuerySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    question: { type: String, required: true, maxlength: 500 },
    grounded: { type: Boolean, default: false },
    refused: { type: Boolean, default: false },
    citationCount: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

tutorQuerySchema.index({ course: 1, grounded: 1, createdAt: -1 });
tutorQuerySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const TutorQuery =
  mongoose.models.TutorQuery || mongoose.model("TutorQuery", tutorQuerySchema);

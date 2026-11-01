import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    status: { type: String, enum: ["active", "completed", "dropped"], default: "active" },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, status: 1 });

cleanJson(enrollmentSchema);

export const Enrollment =
  mongoose.models.Enrollment || mongoose.model("Enrollment", enrollmentSchema);

import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const learningProgressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    completedLessonIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    completedLessons: { type: Number, default: 0, min: 0 },
    totalLessons: { type: Number, default: 0, min: 0 },
    percent: { type: Number, default: 0, min: 0, max: 100 },
    lastLesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    /** Resume positions in seconds, keyed by lesson id. */
    lessonPositions: { type: Map, of: Number, default: {} },
    watchSeconds: { type: Number, default: 0, min: 0 },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

learningProgressSchema.index({ student: 1, course: 1 }, { unique: true });
learningProgressSchema.index({ course: 1, lastAccessedAt: -1 });

cleanJson(learningProgressSchema);

export const LearningProgress =
  mongoose.models.LearningProgress ||
  mongoose.model("LearningProgress", learningProgressSchema);

import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const topicMasterySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    topic: { type: String, required: true, trim: true, maxlength: 60 },
    /** Exponentially weighted estimate of mastery in [0, 1]. */
    score: { type: Number, required: true, min: 0, max: 1 },
    attempts: { type: Number, default: 0, min: 0 },
    correct: { type: Number, default: 0, min: 0 },
    lastAssessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

topicMasterySchema.index({ student: 1, course: 1, topic: 1 }, { unique: true });
topicMasterySchema.index({ course: 1, score: 1 });

cleanJson(topicMasterySchema);

export const TopicMastery =
  mongoose.models.TopicMastery || mongoose.model("TopicMastery", topicMasterySchema);

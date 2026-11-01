import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const studyPlanSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    items: [
      {
        _id: false,
        type: { type: String, enum: ["revisit", "practice", "advance"], required: true },
        title: { type: String, required: true },
        topic: String,
        lessonId: mongoose.Schema.Types.ObjectId,
        reason: String,
        minutes: Number,
      },
    ],
    summary: { type: String, default: "" },
    generatedBy: { type: String, enum: ["rules", "llm"], default: "rules" },
    signature: { type: String, default: "" },
  },
  { timestamps: true },
);

studyPlanSchema.index({ student: 1, course: 1 }, { unique: true });

cleanJson(studyPlanSchema);

export const StudyPlan =
  mongoose.models.StudyPlan || mongoose.model("StudyPlan", studyPlanSchema);

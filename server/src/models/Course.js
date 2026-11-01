import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
    /** Duration in WEEKS (documented in docs/data-model.md). */
    duration: { type: Number, required: true, min: 1, max: 104 },
    instructor: { type: String, trim: true, maxlength: 120, default: "" },
    tags: { type: [{ type: String, trim: true, maxlength: 30 }], default: [] },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    source: {
      type: { type: String, enum: ["manual", "youtube-playlist"], default: "manual" },
      playlistId: { type: String, default: "" },
      channel: { type: String, default: "" },
    },
    lessonCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

courseSchema.index({ status: 1, category: 1, createdAt: -1 });
courseSchema.index({ title: "text", description: "text", tags: "text" });

cleanJson(courseSchema);

export const Course = mongoose.models.Course || mongoose.model("Course", courseSchema);

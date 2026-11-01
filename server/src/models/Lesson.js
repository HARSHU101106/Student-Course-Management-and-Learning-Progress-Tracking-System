import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    order: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    module: { type: String, trim: true, maxlength: 120, default: "" },
    videoId: {
      type: String,
      default: "",
      validate: {
        validator: (value) => value === "" || YOUTUBE_ID.test(value),
        message: "videoId must be a valid 11-character YouTube video ID.",
      },
    },
    durationSec: { type: Number, min: 0, default: 0 },
    topics: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    /** Study notes / transcript. Source text for the RAG tutor and quiz generator. */
    notes: { type: String, maxlength: 20000, default: "" },
    /** Lecture number in the original source playlist (used to attach videos later). */
    sourceIndex: { type: Number, min: 1 },
  },
  { timestamps: true },
);

lessonSchema.index({ course: 1, order: 1 });

cleanJson(lessonSchema);

export const Lesson = mongoose.models.Lesson || mongoose.model("Lesson", lessonSchema);

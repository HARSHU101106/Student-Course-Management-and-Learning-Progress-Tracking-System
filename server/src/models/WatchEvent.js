import mongoose from "mongoose";

const watchEventSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true },
    event: {
      type: String,
      enum: ["play", "pause", "seek", "ended", "heartbeat"],
      required: true,
    },
    positionSec: { type: Number, min: 0, default: 0 },
    deltaSec: { type: Number, min: 0, max: 120, default: 0 },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

watchEventSchema.index({ student: 1, at: -1 });
// Raw engagement events are only useful short-term; aggregates live in LearningProgress.
watchEventSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const WatchEvent =
  mongoose.models.WatchEvent || mongoose.model("WatchEvent", watchEventSchema);

import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["system", "course", "enrollment", "progress", "quiz", "message", "announcement"],
      default: "system",
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, trim: true, maxlength: 500, default: "" },
    link: { type: String, trim: true, maxlength: 200, default: "" },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

cleanJson(notificationSchema);

export const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

/**
 * Chat message. `room` is either `course:<courseId>` (group discussion)
 * or `dm:<lowerUserId>:<higherUserId>` (direct message).
 */
const messageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, maxlength: 80 },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ room: 1, createdAt: -1 });

cleanJson(messageSchema);

export const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export function dmRoom(a, b) {
  const [first, second] = [String(a), String(b)].sort();
  return `dm:${first}:${second}`;
}

import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const questionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, trim: true, maxlength: 600 },
  options: {
    type: [{ type: String, trim: true, maxlength: 300 }],
    validate: {
      validator: (value) => value.length >= 2 && value.length <= 6,
      message: "A question needs between 2 and 6 options.",
    },
  },
  answerIndex: { type: Number, required: true, min: 0 },
  explanation: { type: String, trim: true, maxlength: 800, default: "" },
  topic: { type: String, trim: true, maxlength: 60, default: "General" },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
});

questionSchema.path("answerIndex").validate(function checkRange(value) {
  return Array.isArray(this.options) && value < this.options.length;
}, "answerIndex must point at one of the options.");

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (value) => value.length >= 1 && value.length <= 50,
        message: "A quiz needs between 1 and 50 questions.",
      },
    },
    /** AI-generated quizzes start as drafts and need admin review before students see them. */
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    source: { type: String, enum: ["manual", "ai"], default: "manual" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

quizSchema.index({ course: 1, status: 1 });

cleanJson(quizSchema);

export const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", quizSchema);

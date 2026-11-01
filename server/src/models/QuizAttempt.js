import mongoose from "mongoose";
import { cleanJson } from "./plugins.js";

const quizAttemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    answers: { type: [Number], default: [] },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    percent: { type: Number, required: true, min: 0, max: 100 },
    results: [
      {
        _id: false,
        questionId: mongoose.Schema.Types.ObjectId,
        topic: String,
        correct: Boolean,
      },
    ],
  },
  { timestamps: true },
);

quizAttemptSchema.index({ student: 1, quiz: 1, createdAt: -1 });
quizAttemptSchema.index({ course: 1, createdAt: -1 });

cleanJson(quizAttemptSchema);

export const QuizAttempt =
  mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", quizAttemptSchema);

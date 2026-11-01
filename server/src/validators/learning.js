import { z } from "zod";
import { objectId, pagination } from "./common.js";

export const enrollBody = z.object({ courseId: objectId }).strict();
export const courseIdParam = z.object({ courseId: objectId }).strict();

export const listEnrollmentsQuery = z
  .object({
    courseId: objectId.optional(),
    status: z.enum(["active", "completed", "dropped"]).optional(),
    ...pagination,
  })
  .strict();

export const progressLessonParams = z
  .object({ courseId: objectId, lessonId: objectId })
  .strict();

export const progressLessonBody = z
  .object({
    completed: z.boolean().default(true),
    positionSec: z.number().min(0).max(60 * 60 * 24).optional(),
  })
  .strict();

export const watchBody = z
  .object({
    events: z
      .array(
        z
          .object({
            courseId: objectId,
            lessonId: objectId,
            event: z.enum(["play", "pause", "seek", "ended", "heartbeat"]),
            positionSec: z.number().min(0).max(60 * 60 * 24).default(0),
            deltaSec: z.number().min(0).max(120).default(0),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

const question = z
  .object({
    prompt: z.string().trim().min(3).max(600),
    options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
    answerIndex: z.number().int().min(0),
    explanation: z.string().trim().max(800).optional(),
    topic: z.string().trim().min(1).max(60).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  })
  .strict()
  .refine((value) => value.answerIndex < value.options.length, {
    message: "answerIndex must point at one of the options.",
    path: ["answerIndex"],
  });

export const createQuizBody = z
  .object({
    course: objectId,
    lesson: objectId.optional(),
    title: z.string().trim().min(3).max(160),
    questions: z.array(question).min(1).max(50),
    status: z.enum(["draft", "published"]).optional(),
  })
  .strict();

export const updateQuizBody = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    questions: z.array(question).min(1).max(50).optional(),
    status: z.enum(["draft", "published"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field." });

export const listQuizzesQuery = z
  .object({
    courseId: objectId,
    status: z.enum(["draft", "published", "all"]).optional(),
  })
  .strict();

export const attemptBody = z
  .object({
    answers: z.array(z.number().int().min(-1).max(5)).min(1).max(50),
  })
  .strict();

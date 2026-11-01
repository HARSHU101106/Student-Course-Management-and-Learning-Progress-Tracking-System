import { z } from "zod";
import { objectId } from "./common.js";

export const tutorBody = z
  .object({
    courseId: objectId,
    lessonId: objectId.optional(),
    question: z.string().trim().min(3, "Ask a complete question.").max(500),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(1500),
          })
          .strict(),
      )
      .max(6)
      .optional(),
  })
  .strict();

export const generateQuizBody = z
  .object({
    courseId: objectId,
    lessonId: objectId.optional(),
    count: z.number().int().min(1).max(10).default(5),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  })
  .strict();

const playlistUrl = z.string().trim().min(10).max(300).url("Enter a valid URL.");

export const playlistBody = z.object({ url: playlistUrl }).strict();

export const createFromPlaylistBody = z
  .object({
    url: playlistUrl,
    title: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    category: z.string().trim().min(2).max(60).default("General"),
    level: z.enum(["Beginner", "Intermediate", "Advanced"]).default("Beginner"),
    publish: z.boolean().default(false),
  })
  .strict();

export const atRiskQuery = z.object({ courseId: objectId.optional() }).strict();

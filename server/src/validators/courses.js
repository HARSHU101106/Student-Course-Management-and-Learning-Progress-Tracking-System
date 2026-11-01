import { z } from "zod";
import { nonEmptyObject, objectId, pagination } from "./common.js";
import { YOUTUBE_ID } from "../models/Lesson.js";

const level = z.enum(["Beginner", "Intermediate", "Advanced"]);
const tags = z.array(z.string().trim().min(1).max(30)).max(10);

export const listCoursesQuery = z
  .object({
    q: z.string().trim().max(80).optional(),
    category: z.string().trim().max(60).optional(),
    level: level.optional(),
    status: z.enum(["draft", "published", "all"]).optional(),
    sort: z.enum(["newest", "title", "duration"]).default("newest"),
    ...pagination,
  })
  .strict();

export const courseIdOrSlugParam = z
  .object({ id: z.string().trim().min(1).max(120) })
  .strict();

export const createCourseBody = z
  .object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().min(10).max(2000),
    category: z.string().trim().min(2).max(60),
    level: level.optional(),
    duration: z.number().int().min(1).max(104),
    instructor: z.string().trim().max(120).optional(),
    tags: tags.optional(),
    status: z.enum(["draft", "published"]).optional(),
  })
  .strict();

export const updateCourseBody = nonEmptyObject(createCourseBody.partial());

const lessonFields = {
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  module: z.string().trim().max(120).optional(),
  videoId: z.string().trim().regex(YOUTUBE_ID, "Must be an 11-character YouTube video ID.").or(z.literal("")).optional(),
  durationSec: z.number().int().min(0).max(60 * 60 * 12).optional(),
  topics: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  notes: z.string().max(20000).optional(),
  order: z.number().int().min(0).optional(),
};

export const createLessonBody = z.object(lessonFields).strict();
export const updateLessonBody = nonEmptyObject(z.object(lessonFields).partial().strict());

export const lessonParams = z.object({ lessonId: objectId }).strict();
export const courseLessonParams = z.object({ id: objectId, lessonId: objectId }).strict();

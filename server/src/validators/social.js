import { z } from "zod";
import { objectId, pagination } from "./common.js";

export const listNotificationsQuery = z
  .object({
    unread: z.enum(["true", "false"]).optional(),
    ...pagination,
  })
  .strict();

export const broadcastBody = z
  .object({
    title: z.string().trim().min(2).max(140),
    body: z.string().trim().max(500).optional(),
    courseId: objectId.optional(),
    link: z.string().trim().max(200).optional(),
  })
  .strict();

export const roomParam = z
  .object({ room: z.string().trim().regex(/^course:[a-f\d]{24}$/i, "Invalid room.") })
  .strict();

export const userIdParam = z.object({ userId: objectId }).strict();

export const messagesQuery = z
  .object({
    before: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(40),
  })
  .strict();

export const sendMessageBody = z
  .object({
    room: z.string().trim().regex(/^course:[a-f\d]{24}$/i).optional(),
    to: objectId.optional(),
    text: z.string().trim().min(1).max(2000),
  })
  .strict()
  .refine((value) => Boolean(value.room) !== Boolean(value.to), {
    message: "Provide exactly one of room or to.",
  });

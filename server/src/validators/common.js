import { z } from "zod";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid id.");

export const idParam = z.object({ id: objectId }).strict();

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address.");

/** Matches the assignment's secure registration (>= 12 chars) and bcrypt's 72-byte limit. */
export const password = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Password must be at most 72 bytes.",
  });

export const personName = z.string().trim().min(2, "Name is too short.").max(80);

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
};

export const nonEmptyObject = (schema) =>
  schema.refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

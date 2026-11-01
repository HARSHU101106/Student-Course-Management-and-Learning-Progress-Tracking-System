import { z } from "zod";
import { email, nonEmptyObject, password, personName } from "./common.js";

export const registerBody = z
  .object({
    name: personName,
    email,
    password,
    department: z.string().trim().max(80).optional(),
  })
  .strict();

export const loginBody = z
  .object({
    email,
    password: z
      .string()
      .min(1, "Password is required.")
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72, { message: "Invalid credentials." }),
  })
  .strict();

export const changePasswordBody = z
  .object({ currentPassword: z.string().min(1).max(72), newPassword: password })
  .strict();

export const profileBody = nonEmptyObject(
  z
    .object({
      name: personName.optional(),
      department: z.string().trim().max(80).optional(),
      weeklyHours: z.number().int().min(1).max(80).optional(),
    })
    .strict(),
);

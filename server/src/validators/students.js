import { z } from "zod";
import { email, nonEmptyObject, pagination, password, personName } from "./common.js";

export const listStudentsQuery = z
  .object({
    q: z.string().trim().max(80).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    ...pagination,
  })
  .strict();

export const createStudentBody = z
  .object({
    name: personName,
    email,
    password,
    department: z.string().trim().max(80).optional(),
  })
  .strict();

export const updateStudentBody = nonEmptyObject(
  z
    .object({
      name: personName.optional(),
      email: email.optional(),
      department: z.string().trim().max(80).optional(),
      weeklyHours: z.number().int().min(1).max(80).optional(),
      isActive: z.boolean().optional(),
      password: password.optional(),
    })
    .strict(),
);

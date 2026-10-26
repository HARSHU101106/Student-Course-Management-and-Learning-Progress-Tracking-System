import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { ApiError } from "../utils/ApiError.js";

const students = [];

function publicStudent(student) {
  const { id, name, email, department, createdAt } = student;
  return { id, name, email, department, role: "student", createdAt };
}

export async function registerStudent({ name, email, password, department }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (students.some((student) => student.email === normalizedEmail)) {
    throw new ApiError(409, "Email is already registered.");
  }

  const student = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    department: department.trim(),
    createdAt: new Date().toISOString(),
  };

  if (students.some((item) => item.email === normalizedEmail)) {
    throw new ApiError(409, "Email is already registered.");
  }
  students.push(student);
  return publicStudent(student);
}

export async function loginStudent({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const student = students.find((item) => item.email === normalizedEmail);
  if (!student || !(await bcrypt.compare(password, student.passwordHash))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  return publicStudent(student);
}

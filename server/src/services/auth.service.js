import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { ApiError } from "../utils/ApiError.js";

const students = [];

function publicStudent(student) {
  const { id, name, email, department, role, createdAt } = student;
  return { id, name, email, department, role, createdAt };
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
    role: "student",
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

export async function createAdminAccount({ email, password, name = "Administrator" }) {
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    throw new ApiError(400, "A valid admin email is required.");
  }
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new ApiError(
      400,
      "Admin password must be at least 12 characters and no more than 72 bytes.",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = students.find((student) => student.email === normalizedEmail);

  if (existing) {
    if (existing.role === "admin") {
      return publicStudent(existing);
    }
    throw new ApiError(409, "This email already belongs to a student account.");
  }

  const admin = {
    id: randomUUID(),
    name: name.trim() || "Administrator",
    email: normalizedEmail,
    department: "",
    passwordHash: await bcrypt.hash(password, 12),
    role: "admin",
    createdAt: new Date().toISOString(),
  };

  students.push(admin);
  return publicStudent(admin);
}

import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { DUMMY_HASH, User } from "../models/index.js";
import { signToken } from "../services/token.service.js";
import { ApiError } from "../utils/ApiError.js";
import { created, ok } from "../utils/http.js";

export async function register(request, response) {
  const { name, email, password, department } = request.valid.body;

  if (await User.exists({ email })) throw ApiError.conflict("Email already registered.");

  // Role is never read from the request body: public registration always creates a student.
  const user = await User.create({ name, email, password, department, role: "student" });
  return created(response, { user }, "Registration successful.");
}

export async function login(request, response) {
  const { email, password } = request.valid.body;

  const user = await User.findOne({ email }).select("+password");
  // Always run bcrypt, even for unknown emails, so response time does not reveal which emails exist.
  const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !matches || !user.isActive) throw ApiError.unauthorized("Invalid email or password.");

  user.lastLoginAt = new Date();
  await user.save();

  return ok(
    response,
    { token: signToken(user), tokenType: "Bearer", expiresIn: env.jwtExpiresIn, user },
    { message: "Login successful." },
  );
}

export async function me(request, response) {
  return ok(response, { user: request.user });
}

export async function getProfile(request, response) {
  return ok(response, { user: request.user });
}

export async function updateProfile(request, response) {
  const user = await User.findById(request.user.id);
  Object.assign(user, request.valid.body);
  await user.save();
  return ok(response, { user }, { message: "Profile updated." });
}

export async function changePassword(request, response) {
  const { currentPassword, newPassword } = request.valid.body;
  const user = await User.findById(request.user.id).select("+password");

  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest("Current password is incorrect.");
  }
  if (currentPassword === newPassword) {
    throw ApiError.badRequest("Choose a new password that differs from the current one.");
  }
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  // Tokens issued before this moment are rejected; hand back a fresh one.
  return ok(response, { token: signToken(user), tokenType: "Bearer", expiresIn: env.jwtExpiresIn }, {
    message: "Password changed.",
  });
}

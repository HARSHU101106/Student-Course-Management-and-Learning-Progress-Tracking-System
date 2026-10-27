import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import {
  validateLogin,
  validateRegistration,
} from "../middleware/authValidation.js";
import { requireAuth } from "../middleware/auth.js";
import { loginStudent, registerStudent } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

router.post(
  "/register",
  validateRegistration,
  asyncHandler(async (request, response) => {
    const student = await registerStudent(request.body);
    return response.status(201).json({
      message: "Student registered successfully",
      student,
      user: student,
    });
  }),
);

router.post(
  "/login",
  validateLogin,
  asyncHandler(async (request, response) => {
    if (Buffer.byteLength(env.jwtSecret, "utf8") < 32) {
      throw new ApiError(500, "Authentication is not configured.");
    }

    const student = await loginStudent(request.body);
    const token = jwt.sign(
      { email: student.email, name: student.name, role: student.role },
      env.jwtSecret,
      {
        subject: student.id,
        expiresIn: env.jwtExpiresIn,
        algorithm: "HS256",
      },
    );

    return response.status(200).json({
      message: "Login successful",
      token,
      tokenType: "Bearer",
      expiresIn: env.jwtExpiresIn,
      student,
      user: student,
    });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    return response.json({
      user: {
        id: request.user.id,
        email: request.user.email,
        role: request.user.role,
      },
    });
  }),
);

export default router;

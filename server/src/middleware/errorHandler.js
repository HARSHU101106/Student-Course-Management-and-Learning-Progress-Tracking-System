import mongoose from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function notFound(request, _response, next) {
  next(new ApiError(404, `Route not found: ${request.method} ${request.originalUrl.split("?")[0]}`));
}

function normalize(error) {
  if (error instanceof ApiError) return error;

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((item) => ({
      path: item.path,
      message: item.message,
    }));
    return new ApiError(400, "Validation failed.", { code: "VALIDATION_ERROR", details });
  }
  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${error.path}.`);
  }
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0] ?? "field";
    return ApiError.conflict(`A record with this ${field} already exists.`);
  }
  if (error?.type === "entity.parse.failed") {
    return ApiError.badRequest("Request body is not valid JSON.");
  }
  if (error?.type === "entity.too.large") {
    return new ApiError(413, "Request body is too large.");
  }
  if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
    return ApiError.unauthorized("Invalid or expired token.");
  }
  if (
    error instanceof mongoose.Error.MongooseServerSelectionError ||
    error?.name === "MongoNetworkError"
  ) {
    return ApiError.unavailable("Database is temporarily unavailable.");
  }
  return null;
}

// Express identifies error middleware by its 4-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, request, response, _next) {
  const known = normalize(error);
  const status = known?.status ?? 500;

  if (status >= 500) {
    // Operational failures we raised ourselves (AI service down, DB unavailable) are warnings;
    // anything else is an unexpected bug and keeps its stack for debugging.
    const operational = Boolean(known);
    console.error(
      JSON.stringify({
        level: operational ? "warn" : "error",
        requestId: request.id,
        method: request.method,
        path: request.originalUrl.split("?")[0],
        message: error?.message,
        stack: operational || env.isProduction ? undefined : error?.stack,
      }),
    );
  }

  if (response.headersSent) return;

  response.status(status).json({
    success: false,
    code: known?.code ?? "INTERNAL_ERROR",
    // Never leak internal error text for unexpected failures.
    message: known ? known.message : "Something went wrong on our side.",
    ...(known?.details ? { details: known.details } : {}),
    requestId: request.id,
  });
}

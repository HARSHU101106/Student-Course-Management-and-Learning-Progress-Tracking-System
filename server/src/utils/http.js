import mongoose from "mongoose";
import { ApiError } from "./ApiError.js";

export function ok(response, data, { status = 200, message, meta } = {}) {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data ?? null;
  if (meta) body.meta = meta;
  return response.status(status).json(body);
}

export function created(response, data, message) {
  return ok(response, data, { status: 201, message });
}

export function paginationMeta({ page, limit, total }) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export function assertObjectId(value, label = "id") {
  if (!mongoose.isValidObjectId(value) || String(value).length !== 24) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
  return value;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "course"
  );
}

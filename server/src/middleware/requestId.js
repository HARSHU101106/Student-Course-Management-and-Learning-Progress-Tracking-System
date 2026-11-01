import { randomUUID } from "node:crypto";

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId(request, response, next) {
  const incoming = request.get("x-request-id");
  request.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader("X-Request-Id", request.id);
  next();
}

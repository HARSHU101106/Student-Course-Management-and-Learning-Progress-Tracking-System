export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code ?? ApiError.codeFor(status);
    this.details = details;
  }

  static codeFor(status) {
    return (
      {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        422: "UNPROCESSABLE",
        429: "RATE_LIMITED",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
      }[status] ?? "INTERNAL_ERROR"
    );
  }

  static badRequest(message, details) {
    return new ApiError(400, message, { details });
  }
  static unauthorized(message = "Authentication is required.") {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have permission to perform this action.") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found.") {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
  static unavailable(message) {
    return new ApiError(503, message);
  }
}

export function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0) {
    throw new Error("At least one role must be allowed.");
  }

  return (request, response, next) => {
    if (!request.user) {
      return response.status(401).json({
        message: "Authentication is required.",
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return response.status(403).json({
        message: "Access denied. Insufficient permissions.",
      });
    }

    return next();
  };
}

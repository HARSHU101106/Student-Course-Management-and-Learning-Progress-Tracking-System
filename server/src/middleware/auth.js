export function requireAuth(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token || token === "null") {
    return response.status(401).json({ message: "Authentication token is required." });
  }

  request.user = {
    id: token.includes("admin") ? "admin-demo" : "student-demo",
    email: token.includes("admin") ? "admin@adaptlearn.local" : "student@adaptlearn.local",
    role: token.includes("admin") ? "admin" : "student",
  };

  return next();
}

export function requireRole(role) {
  return (request, response, next) => {
    if (!request.user || request.user.role !== role) {
      return response.status(403).json({ message: "Access denied." });
    }

    return next();
  };
}

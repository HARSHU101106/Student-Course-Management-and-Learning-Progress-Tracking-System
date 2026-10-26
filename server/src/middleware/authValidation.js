const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration(request, response, next) {
  const { name, email, password, department } = request.body || {};
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof department !== "string"
  ) {
    return response.status(400).json({
      message: "Name, email, password, and department are required.",
    });
  }

  if (
    !name.trim() ||
    !department.trim() ||
    !EMAIL_PATTERN.test(email.trim())
  ) {
    return response.status(400).json({
      message: "Enter a valid name, email, and department.",
    });
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return response.status(400).json({
      message: "Password must be at least 8 characters and no more than 72 bytes.",
    });
  }

  return next();
}

export function validateLogin(request, response, next) {
  const { email, password } = request.body || {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !EMAIL_PATTERN.test(email.trim()) ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return response.status(400).json({
      message: "A valid email and password are required.",
    });
  }

  return next();
}

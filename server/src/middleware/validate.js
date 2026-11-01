import { ApiError } from "../utils/ApiError.js";

/**
 * validate({ body, query, params }) parses each part with a zod schema and stores
 * the typed result on `request.valid`. Unknown keys are rejected by the schemas
 * (they use `.strict()`), which also prevents mass assignment.
 */
export function validate(schemas) {
  return (request, _response, next) => {
    const valid = {};
    const problems = [];

    for (const part of ["params", "query", "body"]) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(request[part] ?? {});
      if (result.success) {
        valid[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          problems.push({
            in: part,
            path: issue.path.join("."),
            message: issue.message,
          });
        }
      }
    }

    if (problems.length) {
      return next(new ApiError(400, "Validation failed.", { code: "VALIDATION_ERROR", details: problems }));
    }
    request.valid = valid;
    return next();
  };
}

import { describe, expect, it } from "vitest";
import { fieldErrors, toApiError } from "../src/lib/api.js";
import { formatSeconds, pluralize, timeAgo } from "../src/lib/format.js";

describe("toApiError", () => {
  it("uses the server's message when present", () => {
    const error = toApiError({ response: { status: 409, data: { message: "Email already registered.", code: "CONFLICT" } } });
    expect(error.message).toBe("Email already registered.");
    expect(error.status).toBe(409);
    expect(error.code).toBe("CONFLICT");
  });

  it("explains network failures and timeouts in plain language", () => {
    expect(toApiError({ message: "Network Error" }).message).toMatch(/cannot reach the server/i);
    expect(toApiError({ code: "ECONNABORTED" }).message).toMatch(/timed out/i);
  });

  it("never leaks raw error text for unexpected responses", () => {
    const error = toApiError({ response: { status: 500, data: "<html>stack trace</html>" } });
    expect(error.message).toBe("Something went wrong. Please try again.");
  });

  it("maps validation details to field errors", () => {
    const error = toApiError({ response: { status: 400, data: { message: "Validation failed.", details: [{ path: "password", message: "Too short" }, { path: "password", message: "ignored" }] } } });
    expect(fieldErrors(error)).toEqual({ password: "Too short" });
  });
});

describe("format helpers", () => {
  it("formats durations and plurals", () => {
    expect(formatSeconds(125)).toBe("2:05");
    expect(formatSeconds(0)).toBe("");
    expect(pluralize(1, "lesson")).toBe("1 lesson");
    expect(pluralize(3, "lesson")).toBe("3 lessons");
  });

  it("describes relative time", () => {
    expect(timeAgo(new Date())).toBe("just now");
    expect(timeAgo(new Date(Date.now() - 3 * 3600 * 1000))).toBe("3 hours ago");
    expect(timeAgo(new Date(Date.now() - 86400 * 1000))).toBe("1 day ago");
  });
});

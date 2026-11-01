import { env } from "../config/env.js";
import { Lesson } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";

export function aiConfigured() {
  return Boolean(env.aiServiceUrl && env.aiServiceToken);
}

async function call(path, { method = "POST", body, timeoutMs = env.aiTimeoutMs, requestId } = {}) {
  if (!aiConfigured()) throw ApiError.unavailable("The AI service is not configured.");

  let response;
  try {
    response = await fetch(`${env.aiServiceUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.aiServiceToken}`,
        ...(requestId ? { "X-Request-Id": requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error?.name === "TimeoutError" ? "timed out" : "is unreachable";
    throw ApiError.unavailable(`The AI service ${reason}. Please try again shortly.`);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof payload?.detail === "string" ? payload.detail : "AI service error.";
    throw new ApiError(response.status === 429 ? 429 : 502, detail);
  }
  return payload;
}

export const ai = {
  tutor: (body, requestId) => call("/v1/tutor/answer", { body, requestId }),
  plan: (body, requestId) => call("/v1/plan", { body, requestId }),
  generateQuiz: (body, requestId) => call("/v1/quiz/generate", { body, requestId }),
  outline: (body, requestId) => call("/v1/studio/outline", { body, requestId }),
  ingest: (body) => call("/v1/ingest", { body, timeoutMs: 60_000 }),
  removeIndex: (courseId) => call(`/v1/ingest/${courseId}`, { method: "DELETE" }),
  health: () => call("/health", { method: "GET", timeoutMs: 3000 }),
};

/** Push a course's lessons into the AI service's retrieval index. */
export async function syncCourseIndex(courseId) {
  const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 }).lean();
  return ai.ingest({
    courseId: String(courseId),
    lessons: lessons.map((lesson) => ({
      id: String(lesson._id),
      title: lesson.title,
      order: lesson.order,
      topics: lesson.topics,
      videoId: lesson.videoId,
      text: [lesson.description, lesson.notes].filter(Boolean).join("\n\n"), // the AI service repairs missing punctuation and de-duplicates
    })),
  });
}

/** Fire-and-forget reindex; failures are logged, never surfaced to the editing admin. */
export function scheduleReindex(courseId) {
  if (!aiConfigured()) return;
  syncCourseIndex(courseId).catch((error) => {
    console.warn(JSON.stringify({ level: "warn", msg: "AI reindex failed", courseId: String(courseId), error: error.message }));
  });
}

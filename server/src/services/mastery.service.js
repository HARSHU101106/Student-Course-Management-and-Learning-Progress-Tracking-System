import { TopicMastery } from "../models/index.js";

/** Weight of the newest answer in the exponentially weighted estimate. */
export const ALPHA = 0.35;
/** Neutral prior for a topic the student has never been assessed on. */
export const PRIOR = 0.5;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const round3 = (value) => Math.round(value * 1000) / 1000;

/** new = old + ALPHA * (outcome - old), where outcome is 1 for correct and 0 for wrong. */
export function nextMastery(current, correct) {
  return round3(clamp01(current + ALPHA * ((correct ? 1 : 0) - current)));
}

/**
 * Fold one quiz attempt into per-topic mastery.
 * `results` is [{ topic, correct }] in question order.
 */
export async function applyAttemptToMastery(studentId, courseId, results) {
  const byTopic = new Map();
  for (const { topic, correct } of results) {
    const key = topic || "General";
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(Boolean(correct));
  }

  const existing = await TopicMastery.find({
    student: studentId,
    course: courseId,
    topic: { $in: [...byTopic.keys()] },
  }).lean();
  const current = new Map(existing.map((row) => [row.topic, row.score]));

  const operations = [];
  for (const [topic, outcomes] of byTopic) {
    let score = current.get(topic) ?? PRIOR;
    for (const correct of outcomes) score = nextMastery(score, correct);
    operations.push({
      updateOne: {
        filter: { student: studentId, course: courseId, topic },
        update: {
          $set: { score, lastAssessedAt: new Date() },
          $inc: { attempts: outcomes.length, correct: outcomes.filter(Boolean).length },
        },
        upsert: true,
      },
    });
  }
  if (operations.length) await TopicMastery.bulkWrite(operations);
  return byTopic.size;
}

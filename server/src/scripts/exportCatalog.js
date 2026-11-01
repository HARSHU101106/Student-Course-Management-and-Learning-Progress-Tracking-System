// Writes the demo catalogue as JSON so the AI service's evaluation uses the same source of truth.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "../data/seedCatalog.js";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../../ai-service/eval/catalog.json");
const courses = catalog.map((entry, ci) => ({
  courseId: `eval-course-${ci + 1}`,
  title: entry.course.title,
  lessons: entry.lessons.map((lesson, li) => ({
    id: `c${ci + 1}l${li + 1}`,
    title: lesson.title,
    order: li + 1,
    topics: lesson.topics,
    text: lesson.notes,
  })),
}));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(courses, null, 2)}\n`);
console.log(`Wrote ${out} (${courses.length} courses, ${courses.reduce((n, c) => n + c.lessons.length, 0)} lessons)`);

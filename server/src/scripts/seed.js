import { fileURLToPath } from "node:url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { catalog } from "../data/seedCatalog.js";
import { Course, Lesson, Quiz, User } from "../models/index.js";
import { aiConfigured, syncCourseIndex } from "../services/ai.service.js";
import { recountLessons, uniqueSlug } from "../services/course.service.js";
import { ensureAdminAccount } from "../services/bootstrap.service.js";

const log = (msg, extra = {}) => console.log(JSON.stringify({ level: "info", msg, ...extra }));

/**
 * Idempotent: courses are matched by title and left untouched if they already exist,
 * so re-running never overwrites edits made in Course Studio.
 * Demo accounts are opt-in because they have a known password.
 */
export async function seedDemoData({ demoUsers = process.env.SEED_DEMO_USERS === "true" } = {}) {
  const admin = await ensureAdminAccount();
  const created = [];

  for (const entry of catalog) {
    if (await Course.exists({ title: entry.course.title })) continue;

    const course = await Course.create({
      ...entry.course,
      slug: await uniqueSlug(entry.course.title),
      status: "published",
      createdBy: admin?._id,
    });

    const lessons = await Lesson.insertMany(
      entry.lessons.map((lesson, index) => ({
        course: course._id,
        order: index + 1,
        title: lesson.title,
        module: lesson.module,
        topics: lesson.topics,
        notes: lesson.notes,
        description: lesson.notes.split(". ")[0].slice(0, 300),
        sourceIndex: lesson.n,
      })),
    );
    await recountLessons(course._id);

    await Quiz.insertMany(
      entry.quizzes.map((quiz) => ({
        course: course._id,
        title: quiz.title,
        questions: quiz.questions,
        status: "published",
        source: "manual",
        createdBy: admin?._id,
      })),
    );
    created.push({ id: String(course._id), title: course.title, lessons: lessons.length });
  }

  if (demoUsers) {
    const password = process.env.DEMO_PASSWORD || "Student-Demo-2026!";
    for (const [name, email] of [
      ["Demo Student", "demo.student@adaptlearn.dev"],
      ["Priya Classmate", "priya.classmate@adaptlearn.dev"],
    ]) {
      if (!(await User.exists({ email }))) {
        await User.create({ name, email, password, department: "Computer Science", role: "student" });
      }
    }
  }

  if (aiConfigured()) {
    for (const course of created) {
      await syncCourseIndex(course.id).catch((error) =>
        log("AI index skipped", { course: course.title, reason: error.message }),
      );
    }
  }

  log("Seed complete", { coursesCreated: created.length, demoUsers });
  return created;
}

// `node src/scripts/seed.js [--demo-users]`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--demo-users")) process.env.SEED_DEMO_USERS = "true";
  try {
    await connectDatabase();
    await seedDemoData();
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "Seed failed", error: error.message }));
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

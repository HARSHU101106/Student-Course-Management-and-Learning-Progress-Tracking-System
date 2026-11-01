import mongoose from "mongoose";
import { Course, Enrollment, Lesson } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { slugify } from "../utils/http.js";

export async function uniqueSlug(title) {
  const base = slugify(title);
  let candidate = base;
  for (let suffix = 2; await Course.exists({ slug: candidate }); suffix += 1) {
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export async function recountLessons(courseId) {
  const count = await Lesson.countDocuments({ course: courseId });
  await Course.updateOne({ _id: courseId }, { lessonCount: count });
  return count;
}

export async function findCourse(idOrSlug) {
  const query = mongoose.isValidObjectId(idOrSlug) && String(idOrSlug).length === 24
    ? { _id: idOrSlug }
    : { slug: String(idOrSlug).toLowerCase() };
  const course = await Course.findOne(query);
  if (!course) throw ApiError.notFound("Course not found.");
  return course;
}

export async function enrollmentFor(studentId, courseId) {
  return Enrollment.findOne({ student: studentId, course: courseId });
}

/** Admins can read anything; students need a non-dropped enrollment on a published course. */
export async function assertCourseAccess(user, course) {
  if (user.role === "admin") return;
  if (course.status !== "published") throw ApiError.notFound("Course not found.");
  const enrollment = await enrollmentFor(user.id, course.id);
  if (!enrollment || enrollment.status === "dropped") {
    throw ApiError.forbidden("Enroll in this course to access it.");
  }
}

export async function deleteCourseCascade(courseId) {
  const { LearningProgress, Quiz, QuizAttempt, TopicMastery, StudyPlan, Message, TutorQuery, WatchEvent } =
    await import("../models/index.js");
  await Promise.all([
    Lesson.deleteMany({ course: courseId }),
    Enrollment.deleteMany({ course: courseId }),
    LearningProgress.deleteMany({ course: courseId }),
    Quiz.deleteMany({ course: courseId }),
    QuizAttempt.deleteMany({ course: courseId }),
    TopicMastery.deleteMany({ course: courseId }),
    StudyPlan.deleteMany({ course: courseId }),
    TutorQuery.deleteMany({ course: courseId }),
    WatchEvent.deleteMany({ course: courseId }),
    Message.deleteMany({ room: `course:${courseId}` }),
  ]);
  await Course.deleteOne({ _id: courseId });
}

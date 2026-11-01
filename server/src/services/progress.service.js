import { Enrollment, LearningProgress, Lesson } from "../models/index.js";
import { notifyUsers } from "./notification.service.js";

/** Recompute derived progress fields from the set of completed lessons. */
export async function refreshProgress(progress, courseTitle) {
  const lessonIds = await Lesson.find({ course: progress.course }).distinct("_id");
  const valid = new Set(lessonIds.map(String));
  progress.completedLessonIds = progress.completedLessonIds.filter((id) => valid.has(String(id)));
  progress.completedLessons = progress.completedLessonIds.length;
  progress.totalLessons = lessonIds.length;
  progress.percent = progress.totalLessons
    ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
    : 0;
  progress.lastAccessedAt = new Date();
  await progress.save();

  const enrollment = await Enrollment.findOne({ student: progress.student, course: progress.course });
  if (enrollment && enrollment.status !== "dropped") {
    const done = progress.totalLessons > 0 && progress.percent === 100;
    if (done && enrollment.status !== "completed") {
      enrollment.status = "completed";
      enrollment.completedAt = new Date();
      await enrollment.save();
      await notifyUsers([progress.student], {
        type: "progress",
        title: "Course completed",
        body: `You finished every lesson in ${courseTitle}.`,
        link: `/courses/${progress.course}`,
      });
    } else if (!done && enrollment.status === "completed") {
      enrollment.status = "active";
      enrollment.completedAt = undefined;
      await enrollment.save();
    }
  }
  return progress;
}

export async function getOrCreateProgress(studentId, courseId) {
  return (
    (await LearningProgress.findOne({ student: studentId, course: courseId })) ??
    new LearningProgress({ student: studentId, course: courseId })
  );
}

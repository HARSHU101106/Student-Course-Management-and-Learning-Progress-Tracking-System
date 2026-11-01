import { Router } from "express";
import * as admin from "../controllers/adminController.js";
import * as aiCtl from "../controllers/aiController.js";
import * as auth from "../controllers/authController.js";
import * as courses from "../controllers/courseController.js";
import * as enrollments from "../controllers/enrollmentController.js";
import * as messages from "../controllers/messageController.js";
import * as notifications from "../controllers/notificationController.js";
import * as progress from "../controllers/progressController.js";
import * as quizzes from "../controllers/quizController.js";
import * as students from "../controllers/studentController.js";
import { optionalAuth, requireAdmin, requireAuth, requireStudent } from "../middleware/auth.js";
import { aiLimiter, loginLimiter, registerLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import * as v from "../validators/index.js";

const router = Router();
const adminOnly = [requireAuth, requireAdmin];
const studentOnly = [requireAuth, requireStudent];

/* auth + profile */
router.post("/auth/register", registerLimiter, validate({ body: v.registerBody }), auth.register);
router.post("/auth/login", loginLimiter, validate({ body: v.loginBody }), auth.login);
router.get("/auth/me", requireAuth, auth.me);
router.post("/auth/change-password", requireAuth, validate({ body: v.changePasswordBody }), auth.changePassword);
router.get("/profile", requireAuth, auth.getProfile);
router.put("/profile", requireAuth, validate({ body: v.profileBody }), auth.updateProfile);

/* students (admin CRUD) */
router.get("/students", ...adminOnly, validate({ query: v.listStudentsQuery }), students.listStudents);
router.post("/students", ...adminOnly, validate({ body: v.createStudentBody }), students.createStudent);
router.get("/students/:id", ...adminOnly, validate({ params: v.idParam }), students.getStudent);
router.put("/students/:id", ...adminOnly, validate({ params: v.idParam, body: v.updateStudentBody }), students.updateStudent);
router.delete("/students/:id", ...adminOnly, validate({ params: v.idParam }), students.deleteStudent);

/* courses + lessons */
router.get("/courses", optionalAuth, validate({ query: v.listCoursesQuery }), courses.listCourses);
router.post("/courses", ...adminOnly, validate({ body: v.createCourseBody }), courses.createCourse);
router.get("/courses/:id", optionalAuth, validate({ params: v.courseIdOrSlugParam }), courses.getCourse);
router.put("/courses/:id", ...adminOnly, validate({ params: v.idParam, body: v.updateCourseBody }), courses.updateCourse);
router.delete("/courses/:id", ...adminOnly, validate({ params: v.idParam }), courses.deleteCourse);
router.get("/courses/:id/lessons", requireAuth, validate({ params: v.idParam }), courses.listLessons);
router.post("/courses/:id/lessons", ...adminOnly, validate({ params: v.idParam, body: v.createLessonBody }), courses.createLesson);
router.put("/courses/:id/lessons/:lessonId", ...adminOnly, validate({ params: v.courseLessonParams, body: v.updateLessonBody }), courses.updateLesson);
router.delete("/courses/:id/lessons/:lessonId", ...adminOnly, validate({ params: v.courseLessonParams }), courses.deleteLesson);
router.get("/lessons/:lessonId", requireAuth, validate({ params: v.lessonParams }), courses.getLesson);

/* enrollments */
router.get("/enrollments/my-courses", ...studentOnly, validate({ query: v.listEnrollmentsQuery }), enrollments.myCourses);
router.get("/enrollments", ...adminOnly, validate({ query: v.listEnrollmentsQuery }), enrollments.listEnrollments);
router.post("/enrollments", ...studentOnly, validate({ body: v.enrollBody }), enrollments.enroll);
router.delete("/enrollments/:courseId", ...studentOnly, validate({ params: v.courseIdParam }), enrollments.unenroll);

/* learning progress */
router.get("/progress/my-progress", ...studentOnly, progress.myProgress);
router.get("/progress/summary", ...studentOnly, progress.summary);
router.post("/progress/watch", ...studentOnly, validate({ body: v.watchBody }), progress.recordWatch);
router.get("/progress/:courseId", ...studentOnly, validate({ params: v.courseIdParam }), progress.courseProgress);
router.put(
  "/progress/:courseId/lessons/:lessonId",
  ...studentOnly,
  validate({ params: v.progressLessonParams, body: v.progressLessonBody }),
  progress.setLessonProgress,
);

/* quizzes */
router.get("/quizzes", requireAuth, validate({ query: v.listQuizzesQuery }), quizzes.listQuizzes);
router.post("/quizzes", ...adminOnly, validate({ body: v.createQuizBody }), quizzes.createQuiz);
router.get("/quizzes/:id", requireAuth, validate({ params: v.idParam }), quizzes.getQuiz);
router.put("/quizzes/:id", ...adminOnly, validate({ params: v.idParam, body: v.updateQuizBody }), quizzes.updateQuiz);
router.delete("/quizzes/:id", ...adminOnly, validate({ params: v.idParam }), quizzes.deleteQuiz);
router.post("/quizzes/:id/attempts", ...studentOnly, validate({ params: v.idParam, body: v.attemptBody }), quizzes.submitAttempt);
router.get("/quizzes/:id/attempts/me", ...studentOnly, validate({ params: v.idParam }), quizzes.myAttempts);

/* notifications */
router.get("/notifications", requireAuth, validate({ query: v.listNotificationsQuery }), notifications.listNotifications);
router.patch("/notifications/read-all", requireAuth, notifications.markAllRead);
router.post("/notifications/broadcast", ...adminOnly, validate({ body: v.broadcastBody }), notifications.broadcast);
router.patch("/notifications/:id/read", requireAuth, validate({ params: v.idParam }), notifications.markRead);
router.delete("/notifications/:id", requireAuth, validate({ params: v.idParam }), notifications.deleteNotification);

/* chat history + REST send fallback */
router.get("/messages/contacts", requireAuth, messages.contacts);
router.get("/messages/rooms", requireAuth, messages.rooms);
router.get("/messages/rooms/:room", requireAuth, validate({ params: v.roomParam, query: v.messagesQuery }), messages.roomHistory);
router.get("/messages/dm/:userId", requireAuth, validate({ params: v.userIdParam, query: v.messagesQuery }), messages.dmHistory);
router.post("/messages", requireAuth, validate({ body: v.sendMessageBody }), messages.postMessage);

/* AI (proxied to the FastAPI service) */
router.post("/ai/tutor", requireAuth, aiLimiter, validate({ body: v.tutorBody }), aiCtl.askTutor);
router.get("/ai/plan/:courseId", ...studentOnly, aiLimiter, validate({ params: v.courseIdParam }), aiCtl.getPlan);
router.post("/ai/plan/:courseId/regenerate", ...studentOnly, aiLimiter, validate({ params: v.courseIdParam }), aiCtl.regeneratePlan);
router.post("/ai/quiz/generate", ...adminOnly, aiLimiter, validate({ body: v.generateQuizBody }), aiCtl.generateQuiz);

/* admin */
router.get("/admin/stats", ...adminOnly, admin.stats);
router.get("/admin/reports/at-risk", ...adminOnly, validate({ query: v.atRiskQuery }), admin.atRisk);
router.get("/admin/reports/content-gaps", ...adminOnly, admin.contentGaps);
router.post("/admin/playlists/preview", ...adminOnly, validate({ body: v.playlistBody }), admin.previewPlaylist);
router.post("/admin/courses/from-playlist", ...adminOnly, validate({ body: v.createFromPlaylistBody }), admin.createFromPlaylist);
router.post("/admin/courses/:id/attach-playlist", ...adminOnly, validate({ params: v.idParam, body: v.playlistBody }), admin.attachPlaylist);
router.post("/admin/courses/:id/reindex", ...adminOnly, validate({ params: v.idParam }), admin.reindexCourse);

export default router;

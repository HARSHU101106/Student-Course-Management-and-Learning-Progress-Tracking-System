/* ============================================================
   progressService.js
   ============================================================ */
const ProgressService = {
  async getForCourse(courseId) {
    return apiClient.get(`/progress/${courseId}`);
  },
  async getOverview() {
    return apiClient.get('/progress/overview');
  },
  async markLessonComplete(courseId, lessonId) {
    return apiClient.post(`/progress/${courseId}/lessons/${lessonId}/complete`);
  },
};
window.ProgressService = ProgressService;

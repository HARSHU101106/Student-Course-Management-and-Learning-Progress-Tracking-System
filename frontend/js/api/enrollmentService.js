/* ============================================================
   enrollmentService.js
   ============================================================ */
const EnrollmentService = {
  async myEnrollments() {
    return apiClient.get('/enrollments/me');
  },
  async enroll(courseId) {
    return apiClient.post('/enrollments', { courseId });
  },
  async unenroll(enrollmentId) {
    return apiClient.delete(`/enrollments/${enrollmentId}`);
  },
  async allForAdmin(params = {}) {
    return apiClient.get('/enrollments', { params });
  },
};
window.EnrollmentService = EnrollmentService;

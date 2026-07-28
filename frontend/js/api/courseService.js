/* ============================================================
   courseService.js
   ============================================================ */
const CourseService = {
  async list(params = {}) {
    return apiClient.get('/courses', { params });
  },
  async getById(courseId) {
    return apiClient.get(`/courses/${courseId}`);
  },
  async create(payload) {
    return apiClient.post('/courses', payload);
  },
  async update(courseId, payload) {
    return apiClient.put(`/courses/${courseId}`, payload);
  },
  async remove(courseId) {
    return apiClient.delete(`/courses/${courseId}`);
  },
  async categories() {
    return apiClient.get('/courses/categories');
  },
};
window.CourseService = CourseService;

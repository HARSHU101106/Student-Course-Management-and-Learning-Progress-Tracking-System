import { apiClient } from "./axios.js";

export const studentApi = {
  async enroll(courseId) {
    const response = await apiClient.post("/v1/enrollments", { courseId });
    return response.data;
  },

  async getMyCourses() {
    const response = await apiClient.get("/v1/enrollments/my-courses");
    return response.data.enrollments ?? [];
  },

  async unenroll(courseId) {
    const response = await apiClient.delete(`/v1/enrollments/${courseId}`);
    return response.data;
  },

  async getMyProgress() {
    const response = await apiClient.get("/v1/progress/my-progress");
    return response.data.progress ?? [];
  },

  async updateProgress(courseId, completedLessons, totalLessons) {
    const response = await apiClient.put("/v1/progress", {
      courseId,
      completedLessons,
      totalLessons,
    });
    return response.data.progress;
  },
};

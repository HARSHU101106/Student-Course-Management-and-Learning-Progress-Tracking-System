import { apiClient } from "./axios.js";

export const coursesApi = {
  async getCourses() {
    const response = await apiClient.get("/courses");
    return response.data.items ?? [];
  },

  async getCourseById(courseId) {
    const response = await apiClient.get(`/courses/${courseId}`);
    return response.data;
  },

  async getLessons() {
    const response = await apiClient.get("/lessons");
    return response.data.items ?? [];
  },

  async getMyEnrollments() {
    const response = await apiClient.get("/enrollments/me");
    return response.data;
  },
};

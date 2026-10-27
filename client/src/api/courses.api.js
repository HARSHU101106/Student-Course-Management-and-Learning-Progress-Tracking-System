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
    const response = await apiClient.get("/v1/enrollments/my-courses");
    return response.data;
  },

  async createCourse(course) {
    const response = await apiClient.post("/v1/courses", course);
    return response.data;
  },

  async updateCourse(courseId, course) {
    const response = await apiClient.put(`/v1/courses/${courseId}`, course);
    return response.data;
  },

  async deleteCourse(courseId) {
    const response = await apiClient.delete(`/v1/courses/${courseId}`);
    return response.data;
  },
};

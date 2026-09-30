import { apiClient } from "./axios.js";

export const aiApi = {
  async getPlan(courseId) {
    const response = await apiClient.get(`/ai/plan/${courseId}`);
    return response.data;
  },

  async regeneratePlan(courseId) {
    const response = await apiClient.post(`/ai/plan/${courseId}/regenerate`);
    return response.data;
  },

  async askTutor(question, lessonId = "dbms-lesson-1", timestamp = 0) {
    const response = await apiClient.post("/ai/tutor", {
      question,
      lessonId,
      timestamp,
    });
    return response.data;
  },

  async generateQuiz(lessonId) {
    const response = await apiClient.post("/ai/quiz/generate", { lessonId });
    return response.data;
  },

  async recordWatchEvent(event) {
    const response = await apiClient.post("/progress/watch", {
      events: [event],
    });
    return response.data;
  },
};

export async function importYouTubePlaylist(url) {
  const response = await apiClient.post("/admin/playlists/import", { url });
  return response.data;
}

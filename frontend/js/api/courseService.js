import api from "./axiosClient.js";

export const getCourses = async () => api.get("/api/courses");

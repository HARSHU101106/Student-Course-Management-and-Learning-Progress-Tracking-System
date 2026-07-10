import api from "./axiosClient.js";

export const getEnrollments = async () => api.get("/api/enrollments");

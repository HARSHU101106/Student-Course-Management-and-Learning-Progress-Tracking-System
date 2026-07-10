import api from "./axiosClient.js";

export const getProgress = async () => api.get("/api/progress");

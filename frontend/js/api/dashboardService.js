import api from "./axiosClient.js";

export const getDashboard = async () => api.get("/api/dashboard");

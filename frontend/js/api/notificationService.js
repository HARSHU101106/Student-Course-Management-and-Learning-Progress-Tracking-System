import api from "./axiosClient.js";

export const getNotifications = async () => api.get("/api/notifications");

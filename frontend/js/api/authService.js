import api from "./axiosClient.js";

export const login = async (credentials) =>
  api.post("/api/auth/login", credentials);

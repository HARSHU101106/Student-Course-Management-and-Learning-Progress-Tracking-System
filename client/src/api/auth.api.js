import { apiClient } from "./axios.js";

export const authApi = {
  async login({ email, password }) {
    const response = await apiClient.post("/auth/login", { email, password });
    return response.data;
  },

  async register({ name, email, password }) {
    const response = await apiClient.post("/auth/register", { name, email, password });
    return response.data;
  },
};

import { apiClient } from "./axios.js";

export const authApi = {
  async login({ email, password }) {
    const response = await apiClient.post("/v1/auth/login", { email, password });
    return response.data;
  },

  async register({ name, email, password, department }) {
    const response = await apiClient.post("/v1/auth/register", {
      name,
      email,
      password,
      department,
    });
    return response.data;
  },
};

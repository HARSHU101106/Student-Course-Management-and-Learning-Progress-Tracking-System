import axios from "axios";

export const TOKEN_KEY = "adaptlearn.token";
export const API_URL = import.meta.env.VITE_API_URL || "/api/v1";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined; // undefined = same origin

export const api = axios.create({ baseURL: API_URL, timeout: 25000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Turn any axios failure into an Error with a message that is safe to show a student. */
export function toApiError(error) {
  if (error?.isApiError) return error;
  const status = error?.response?.status;
  const body = error?.response?.data;
  let message = body?.message;
  if (!message) {
    if (error?.code === "ECONNABORTED") message = "The request timed out. Please try again.";
    else if (!error?.response) message = "Cannot reach the server. Check your connection and try again.";
    else message = "Something went wrong. Please try again.";
  }
  const friendly = new Error(message);
  friendly.isApiError = true;
  friendly.status = status;
  friendly.code = body?.code;
  friendly.details = body?.details;
  friendly.requestId = body?.requestId;
  return friendly;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error?.config?.url ?? "";
    if (error?.response?.status === 401 && !url.includes("/auth/login")) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(toApiError(error));
  },
);

/** Convenience wrappers returning `data` (and `meta` where present). */
export const get = async (url, params) => (await api.get(url, { params })).data;
export const post = async (url, body) => (await api.post(url, body)).data;
export const put = async (url, body) => (await api.put(url, body)).data;
export const patch = async (url, body) => (await api.patch(url, body)).data;
export const del = async (url) => (await api.delete(url)).data;

/** Field-level messages from a validation error, keyed by field name. */
export function fieldErrors(error) {
  const map = {};
  for (const detail of error?.details ?? []) {
    if (detail.path && !map[detail.path]) map[detail.path] = detail.message;
  }
  return map;
}

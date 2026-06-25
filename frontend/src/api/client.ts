import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8001",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  getMe: () => api.get("/api/v1/auth/me").then((r) => r.data),
  getMyProfile: () => api.get("/api/v1/auth/me/profile").then((r) => r.data),
  getLoginUrl: () => `${api.defaults.baseURL}/api/v1/auth/login`,
};

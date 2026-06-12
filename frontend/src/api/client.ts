import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
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

// ── Auth ──
export const authApi = {
  getMe: () => api.get("/api/v1/auth/me").then((r) => r.data),
  getLoginUrl: () => `${api.defaults.baseURL}/api/v1/auth/login`,
};

// ── Admin ──
export const adminApi = {
  getTenant: () => api.get("/api/v1/admin/tenants/me").then((r) => r.data),
  getIntegrations: () => api.get("/api/v1/admin/integrations").then((r) => r.data),
  getGithubInstallUrl: () => api.get("/api/v1/admin/integrations/github/install-url").then((r) => r.data),
  getJiraAuthUrl: () => api.get("/api/v1/admin/integrations/jira/auth-url").then((r) => r.data),
  getTeamsConsentUrl: () => api.get("/api/v1/admin/integrations/teams/consent-url").then((r) => r.data),
  disconnectIntegration: (type: string) => api.delete(`/api/v1/admin/integrations/${type}`).then((r) => r.data),
  listMappings: (status?: string) => api.get("/api/v1/admin/identity/mappings", { params: { status } }).then((r) => r.data),
  getUnresolved: () => api.get("/api/v1/admin/identity/unresolved").then((r) => r.data),
  resolveMapping: (mapping_id: string, user_id: string) =>
    api.post("/api/v1/admin/identity/resolve", { mapping_id, user_id }).then((r) => r.data),
  getSyncHealth: () => api.get("/api/v1/admin/sync/health").then((r) => r.data),
  getSyncLogs: () => api.get("/api/v1/admin/sync/logs").then((r) => r.data),
  getUsers: () => api.get("/api/v1/admin/users").then((r) => r.data),
};

// ── Employee ──
export const employeeApi = {
  getActivity: (days = 30, source?: string) =>
    api.get("/api/v1/employee/activity", { params: { days, source } }).then((r) => r.data),
  getActivitySummary: (days = 30) =>
    api.get("/api/v1/employee/activity/summary", { params: { days } }).then((r) => r.data),
  getProfile: () => api.get("/api/v1/employee/profile").then((r) => r.data),
  getTeam: (days = 30) => api.get("/api/v1/employee/team", { params: { days } }).then((r) => r.data),
};

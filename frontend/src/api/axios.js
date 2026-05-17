import axios from "axios";
import {
  clearAdminSession,
  getAdminToken,
  isAdminSessionExpired,
  markAdminSessionActive
} from "../utils/adminSession";

const API_ROOT = String(import.meta.env.VITE_API_URL || "http://localhost:5001")
  .trim()
  .replace(/\/+$/, "");
const API_BASE_URL = API_ROOT.endsWith("/api") ? API_ROOT : `${API_ROOT}/api`;

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const requestUrl = String(config.url || "");
  const isLoginRequest = requestUrl.includes("/auth/admin/login");

  if (isLoginRequest) {
    clearAdminSession();
    return config;
  }

  if (isAdminSessionExpired()) {
    clearAdminSession();

    if (window.location.pathname !== "/login") {
      window.location.replace("/login?sessionExpired=1");
    }

    return Promise.reject(new Error("Admin session expired"));
  }

  const token = getAdminToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    markAdminSessionActive();
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAdminSession();

      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;

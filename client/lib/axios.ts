import axios from "axios";
import { API_BASE_URL, TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/constants/config";
import { useAuthStore } from "@/stores/authStore";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function forceLogout() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  useAuthStore.getState().logout();

  const isAuthPage = ["/login", "/register"].includes(window.location.pathname);
  if (!isAuthPage) {
    window.location.href = "/login";
  }
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      forceLogout();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

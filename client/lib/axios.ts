import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@/constants/config";
import { useAuthStore } from "@/stores/authStore";
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  storeAccessToken,
} from "@/lib/authStorage";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function forceLogout() {
  if (typeof window === "undefined") return;

  clearAuthStorage();
  useAuthStore.getState().logout();

  const isAuthPage = ["/login", "/register"].includes(window.location.pathname);
  if (!isAuthPage) {
    window.location.href = "/login";
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("Missing refresh token.");

  const response = await axios.post<{ accessToken: string }>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" } }
  );
  storeAccessToken(response.data.accessToken);
  return response.data.accessToken;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const requestUrl = originalRequest?.url ?? "";
    const isAuthRequest = ["/auth/login", "/auth/register", "/auth/refresh"].some(
      (path) => requestUrl.includes(path)
    );

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest &&
      getRefreshToken()
    ) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const accessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch {
        forceLogout();
      }
    } else if (error.response?.status === 401 && !isAuthRequest) {
      forceLogout();
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

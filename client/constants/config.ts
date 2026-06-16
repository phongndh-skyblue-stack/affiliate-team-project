// Trên browser: dùng relative URL "/api" để Next.js rewrites proxy đến backend
// Trên server (SSR): gọi thẳng vào backend nội bộ
export const API_BASE_URL =
  typeof window === "undefined"
    ? "http://127.0.0.1:4050/api"
    : "/api";

// WS: trên browser tự build URL theo domain hiện tại
export const WS_BASE_URL =
  typeof window === "undefined"
    ? "ws://127.0.0.1:4050"
    : "";

export const APP_NAME = "MIC ACE";

export const TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

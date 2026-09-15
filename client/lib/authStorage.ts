import type { StateStorage } from "zustand/middleware";
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from "@/constants/config";

export const AUTH_STORE_KEY = "auth-storage";

function getBrowserStorage(remember: boolean): Storage | null {
  if (typeof window === "undefined") return null;
  return remember ? window.localStorage : window.sessionStorage;
}

function removeFromBoth(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.sessionStorage.getItem(TOKEN_KEY) ??
    window.localStorage.getItem(TOKEN_KEY)
  );
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.sessionStorage.getItem(REFRESH_TOKEN_KEY) ??
    window.localStorage.getItem(REFRESH_TOKEN_KEY)
  );
}

export function isRememberedSession(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.sessionStorage.getItem(TOKEN_KEY) === null &&
    window.localStorage.getItem(TOKEN_KEY) !== null
  );
}

export function storeAuthTokens(
  accessToken: string,
  refreshToken: string,
  remember: boolean
) {
  removeFromBoth(TOKEN_KEY);
  removeFromBoth(REFRESH_TOKEN_KEY);

  const storage = getBrowserStorage(remember);
  storage?.setItem(TOKEN_KEY, accessToken);
  storage?.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function storeAccessToken(accessToken: string) {
  const storage = getBrowserStorage(isRememberedSession());
  removeFromBoth(TOKEN_KEY);
  storage?.setItem(TOKEN_KEY, accessToken);
}

export function clearAuthStorage() {
  removeFromBoth(TOKEN_KEY);
  removeFromBoth(REFRESH_TOKEN_KEY);
  removeFromBoth(AUTH_STORE_KEY);
}

export const authStateStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    return (
      window.sessionStorage.getItem(name) ??
      window.localStorage.getItem(name)
    );
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    const remember = isRememberedSession();
    const storage = getBrowserStorage(remember);
    const otherStorage = remember
      ? window.sessionStorage
      : window.localStorage;

    otherStorage.removeItem(name);
    storage?.setItem(name, value);
  },
  removeItem: (name) => removeFromBoth(name),
};

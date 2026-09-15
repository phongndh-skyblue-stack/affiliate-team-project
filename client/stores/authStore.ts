import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthUser } from "@/types/auth.types";
import {
  AUTH_STORE_KEY,
  authStateStorage,
  clearAuthStorage,
  storeAuthTokens,
} from "@/lib/authStorage";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (
    user: AuthUser,
    accessToken: string,
    refreshToken: string,
    remember?: boolean
  ) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      setUser: (user, accessToken, refreshToken, remember = true) => {
        storeAuthTokens(accessToken, refreshToken, remember);
        set({ user, isAuthenticated: true });
      },
      logout: () => {
        clearAuthStorage();
        set({ user: null, isAuthenticated: false });
      },
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: AUTH_STORE_KEY,
      storage: createJSONStorage(() => authStateStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

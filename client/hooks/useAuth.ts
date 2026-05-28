"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/auth.service";
import { ROUTES } from "@/constants/routes";
import type { LoginRequest, RegisterRequest } from "@/types/auth.types";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, logout, setLoading } =
    useAuthStore();

  const login = useCallback(
    async (data: LoginRequest) => {
      setLoading(true);
      try {
        const response = await authService.login(data);
        setUser(response.user, response.accessToken, response.refreshToken);
        router.push(ROUTES.DASHBOARD);
      } finally {
        setLoading(false);
      }
    },
    [router, setUser, setLoading]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      setLoading(true);
      try {
        const response = await authService.register(data);
        setUser(response.user, response.accessToken, response.refreshToken);
        router.push(ROUTES.DASHBOARD);
      } finally {
        setLoading(false);
      }
    },
    [router, setUser, setLoading]
  );

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      router.push(ROUTES.LOGIN);
    }
  }, [logout, router]);

  return { user, isAuthenticated, isLoading, login, register, signOut };
}

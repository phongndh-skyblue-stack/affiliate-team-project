"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TOKEN_KEY } from "@/constants/config";

/**
 * Redirects to /dashboard if an access token exists in localStorage.
 * Drop this inside any page that should not be accessible when logged in.
 */
export function RedirectIfAuthenticated() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  return null;
}

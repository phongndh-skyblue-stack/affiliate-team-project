"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/authStorage";

/**
 * Redirects to /dashboard if an access token exists in browser storage.
 * Drop this inside any page that should not be accessible when logged in.
 */
export function RedirectIfAuthenticated() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  return null;
}

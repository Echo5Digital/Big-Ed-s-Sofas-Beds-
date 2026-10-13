"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import AppShell from "./AppShell";

export default function RequireAuth({ children }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-brand-charcoal/60">Loading…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}

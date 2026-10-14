"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import TopBar from "./TopBar";

export default function RequireAuth({ children }) {
  const { status, hasPermission } = useAuth();
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

  if (!hasPermission("pos:sell")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="max-w-sm rounded-xl border border-black/10 bg-white p-6 text-center shadow-sm">
          <p className="font-display text-lg font-bold text-brand-charcoal">Not authorized</p>
          <p className="mt-2 text-sm text-brand-charcoal/60">
            Your account doesn&apos;t have POS cashier access. Ask a manager to grant the CASHIER role.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <TopBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

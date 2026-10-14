"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import AppShell from "./AppShell";

// Pass `permission` on any page whose entire content requires a specific
// permission (e.g. a create/edit form) so navigating to the URL directly —
// not just hiding the nav link or action button — is also blocked. Pages
// that only gate individual actions (not the whole page) should omit this
// and use `useAuth().hasPermission()` inline instead.
export default function RequireAuth({ children, permission }) {
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

  if (permission && !hasPermission(permission)) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="max-w-sm rounded-xl border border-black/10 bg-white p-6 text-center shadow-sm">
            <p className="font-display text-lg font-bold text-brand-charcoal">Not authorized</p>
            <p className="mt-2 text-sm text-brand-charcoal/60">
              Your role doesn&apos;t have permission to view this page. Ask an administrator if you need access.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}

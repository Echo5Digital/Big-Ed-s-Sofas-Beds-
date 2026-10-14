"use client";

import { LogOut, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import Badge from "../ui/Badge";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { session, status } = useRegisterSession();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-brand-navy px-4 py-3 text-white sm:px-6">
      <div className="flex items-center gap-2">
        <Store className="size-5 text-brand-gold" aria-hidden="true" />
        <span className="font-display text-base font-bold">BIG ED POS</span>
        {status === "open" && session && (
          <Badge tone="success">{session.registerName ?? "Register"} · Open</Badge>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-white/70 sm:inline">
          {user?.firstName} {user?.lastName}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </header>
  );
}

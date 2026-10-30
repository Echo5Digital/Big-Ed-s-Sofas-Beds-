"use client";

import { useState } from "react";
import { LogOut, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import CloseRegister from "../register/CloseRegister";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { session, status } = useRegisterSession();
  const router = useRouter();
  const [closeOpen, setCloseOpen] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(false);

  async function finishLogout() {
    await logout();
    router.replace("/login");
  }

  function handleSignOutClick() {
    // A register left OPEN at sign-out is exactly how a register ends up
    // stuck for the next shift (see the reopen-approval flow) — force the
    // cash count now instead of letting it slip through.
    if (status === "open" && session) {
      setBlockedNotice(true);
      return;
    }
    finishLogout();
  }

  function handleCloseAndSignOut() {
    setBlockedNotice(false);
    setCloseOpen(true);
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-brand-navy px-4 py-3 text-white shadow-sm sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gold/15">
          <Store className="size-4.5 text-brand-gold" aria-hidden="true" />
        </span>
        <span className="font-display text-base font-bold tracking-tight">BIG ED POS</span>
        {status === "open" && session && (
          <Badge tone="success" dot>
            {session.registerName ?? "Register"} · Open
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-white/60 sm:inline">
          {user?.firstName} {user?.lastName}
        </span>
        <button
          type="button"
          onClick={handleSignOutClick}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/20 active:scale-[0.98]"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>

      <Modal open={blockedNotice} onClose={() => setBlockedNotice(false)} title="Close your register first">
        <p className="text-sm text-brand-charcoal/60">
          Your register is still open. Count the cash drawer and close it out before signing out, or it&apos;ll be
          left stuck open for the next shift.
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setBlockedNotice(false)}>
            Cancel
          </Button>
          <Button onClick={handleCloseAndSignOut}>Close register</Button>
        </div>
      </Modal>

      <CloseRegister open={closeOpen} onClose={() => setCloseOpen(false)} onClosed={finishLogout} />
    </header>
  );
}

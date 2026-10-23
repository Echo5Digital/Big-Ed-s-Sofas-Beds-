"use client";

import RequireAuth from "@/components/layout/RequireAuth";
import { useRegisterSession } from "@/lib/hooks/useRegisterSession";
import OpenRegister from "@/components/register/OpenRegister";
import CheckoutScreen from "@/components/checkout/CheckoutScreen";

function PosHome() {
  const { status } = useRegisterSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="size-6 animate-spin rounded-full border-2 border-brand-charcoal/15 border-t-brand-red" aria-hidden="true" />
          <p className="text-sm text-brand-charcoal/50">Loading register…</p>
        </div>
      </div>
    );
  }

  if (status === "none") {
    return <OpenRegister />;
  }

  return <CheckoutScreen />;
}

export default function Page() {
  return (
    <RequireAuth>
      <PosHome />
    </RequireAuth>
  );
}

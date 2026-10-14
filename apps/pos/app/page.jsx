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
        <p className="text-sm text-brand-charcoal/60">Loading register…</p>
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

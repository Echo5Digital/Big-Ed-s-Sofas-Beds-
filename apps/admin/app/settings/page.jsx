"use client";

import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { useAuth } from "@/lib/hooks/useAuth";

function SettingsContent() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account and role information" />

      <Card className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-brand-charcoal/60">Signed in as</p>
          <p className="text-base font-semibold text-brand-charcoal">
            {user?.firstName} {user?.lastName} ({user?.email})
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-brand-charcoal/60">Roles</p>
          <p className="text-base text-brand-charcoal">{user?.roles?.join(", ")}</p>
        </div>
        <p className="mt-2 text-sm text-brand-charcoal/50">
          Staff user management, store hours, tax configuration, and integrations (payment provider, email/SMS)
          will live here once those decisions are confirmed with the business.
        </p>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}

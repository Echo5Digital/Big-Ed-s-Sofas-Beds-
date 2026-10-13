"use client";

import RequireAuth from "@/components/layout/RequireAuth";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";

function DeliveriesContent() {
  return (
    <div>
      <PageHeader title="Deliveries" subtitle="Pickup and local delivery scheduling" />
      <Card className="text-sm text-brand-charcoal/60">
        Delivery scheduling and routing is planned for a later milestone, once delivery area, fees, and
        scheduling policy are confirmed with the business. The underlying data model (Delivery, Pickup,
        scheduled date, fee) already exists in the API — this screen will list and manage those records once
        the workflow is approved.
      </Card>
    </div>
  );
}

export default function DeliveriesPage() {
  return (
    <RequireAuth>
      <DeliveriesContent />
    </RequireAuth>
  );
}

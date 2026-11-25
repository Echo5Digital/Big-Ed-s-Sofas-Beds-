"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, XCircle } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const POLL_INTERVAL_MS = 2000;

// Shown while a Square Terminal checkout (POST /pos/sales with a CARD
// payment, see pos.service.js's createCardCheckout) is waiting for the
// customer to tap/insert/swipe on the physical terminal — the webhook is the
// real source of truth for when this resolves (apps/api/src/routes/
// webhooks.routes.js's terminal.checkout.updated handler), this component
// just polls GET /pos/sales/:orderId/status to find out, since there's no
// other way for the browser to learn a server-side webhook fired.
export default function CardCheckoutModal({ orderId, onResolved, onCancel }) {
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!orderId) return undefined;

    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get(`/pos/sales/${orderId}/status`);
        if (cancelled) return;
        if (data.resolved) {
          clearInterval(pollRef.current);
          onResolved(data);
        }
      } catch (err) {
        if (cancelled) return;
        // Transient network error — keep polling rather than giving up on a
        // single failed request; the cashier can still cancel manually.
        setError(err instanceof ApiClientError ? err.message : "Lost connection while checking payment status.");
      }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [orderId, onResolved]);

  async function handleCancel() {
    setCanceling(true);
    setError(null);
    try {
      await api.post(`/pos/sales/${orderId}/cancel-card`, {});
      onCancel();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to cancel — try again.");
      setCanceling(false);
    }
  }

  return (
    <Modal open={Boolean(orderId)} onClose={() => {}} title="Waiting for card">
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
          <CreditCard className="size-8 animate-pulse" aria-hidden="true" />
        </span>
        <p className="text-sm text-brand-charcoal/70">
          Ask the customer to tap, insert, or swipe their card on the register&apos;s terminal.
        </p>

        {error && (
          <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button variant="outline" icon={XCircle} disabled={canceling} onClick={handleCancel} className="w-full">
          {canceling ? "Canceling…" : "Cancel"}
        </Button>
      </div>
    </Modal>
  );
}

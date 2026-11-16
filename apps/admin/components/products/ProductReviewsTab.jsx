"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Check, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api/client";

function ReviewStars({ rating }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rated ${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "text-brand-gold" : "text-brand-charcoal/20"}`}
          fill="currentColor"
          strokeWidth={0}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// A product's Reviews tab — not part of the surrounding product-edit form
// (that form's Save Changes button never touches reviews), so this fetches
// and mutates independently of the rest of the page. 4-5 star reviews arrive
// already APPROVED (auto-published at submission, see
// POST /products/:slug/reviews) and just display here; 1-3 star ones arrive
// PENDING and get the alert treatment + Approve/Delete actions, per the
// "staff can approve or delete, never edit" rule.
export default function ProductReviewsTab({ productId, onPendingCountChange }) {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const load = useCallback(() => {
    api
      .get(`/catalog/admin/products/${productId}/reviews`)
      .then((data) => {
        setReviews(data.reviews);
        onPendingCountChange?.(data.reviews.filter((r) => r.status === "PENDING").length);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load reviews."));
  }, [productId, onPendingCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(review) {
    setActioningId(review.id);
    setError(null);
    try {
      await api.patch(`/catalog/admin/reviews/${review.id}/approve`, {});
      setReviews((prev) => {
        const next = prev.map((r) => (r.id === review.id ? { ...r, status: "APPROVED" } : r));
        onPendingCountChange?.(next.filter((r) => r.status === "PENDING").length);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to approve review.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(review) {
    setActioningId(review.id);
    setError(null);
    try {
      await api.delete(`/catalog/admin/reviews/${review.id}`);
      setReviews((prev) => {
        const next = prev.filter((r) => r.id !== review.id);
        onPendingCountChange?.(next.filter((r) => r.status === "PENDING").length);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete review.");
    } finally {
      setActioningId(null);
    }
  }

  if (reviews === null) {
    return <p className="text-sm text-brand-charcoal/50">Loading reviews…</p>;
  }

  // Pending first — that's the queue staff actually need to act on; approved
  // reviews (already live on the storefront) are reference-only below them.
  const sorted = [...reviews].sort((a, b) => {
    if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-base font-bold text-brand-charcoal">Reviews</h2>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-brand-charcoal/60">No reviews yet for this product.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((review) => (
            <li
              key={review.id}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${
                review.status === "PENDING" ? "border-brand-gold-dark/30 bg-brand-gold/5" : "border-black/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ReviewStars rating={review.rating} />
                  <Badge tone={review.status === "PENDING" ? "warning" : "success"}>
                    {review.status === "PENDING" ? "Needs Review" : "Published"}
                  </Badge>
                </div>
                <p className="text-xs text-brand-charcoal/50">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>

              <p className="text-sm text-brand-charcoal">{review.body}</p>
              <p className="text-xs text-brand-charcoal/60">
                {review.authorName} · {review.authorEmail}
              </p>

              {review.status === "PENDING" && (
                <div className="mt-1 flex gap-2">
                  <Button
                    size="sm"
                    icon={Check}
                    onClick={() => handleApprove(review)}
                    disabled={actioningId === review.id}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={Trash2}
                    onClick={() => handleDelete(review)}
                    disabled={actioningId === review.id}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

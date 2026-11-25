"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";

function formatReviewDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// Read-only star display for a submitted review — separate from the
// clickable picker below (StarPicker), and from the decorative
// components/ui/StarRating used elsewhere on this page for the
// not-backed-by-real-reviews homepage rating.
function ReviewStars({ rating }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Rated ${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-4 ${i < rating ? "text-brand-gold" : "text-brand-charcoal/20"}`}
          fill="currentColor"
          strokeWidth={0}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// Clickable 1-5 star input for the submission form, hover-previewed before a
// value is committed — same visual language as ReviewStars above (filled
// gold vs. empty charcoal/20) so what you pick looks like what gets posted.
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={value === star}
          className="p-1.5"
        >
          <Star
            className={`size-6 transition-colors ${display >= star ? "text-brand-gold" : "text-brand-charcoal/20"}`}
            fill="currentColor"
            strokeWidth={0}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ productSlug, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // "APPROVED" | "PENDING" once posted

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Select a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      const { review } = await api.post(`/catalog/products/${productSlug}/reviews`, {
        rating,
        body,
        authorName,
        authorEmail,
      });
      setSubmitted(review.status);
      if (review.status === "APPROVED") onSubmitted?.(review);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-600/20 bg-green-600/5 p-4 text-sm text-green-800">
        {submitted === "APPROVED"
          ? "Thanks! Your review is now live on this page."
          : "Thanks for your feedback. Your review has been submitted and will appear once our team has reviewed it."}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-brand-charcoal/10 bg-white p-5">
      <div>
        <h3 className="font-display text-base font-bold text-brand-charcoal">Write a Review</h3>
        <p className="mt-1 text-xs text-brand-charcoal/50">
          Fields marked <span className="font-medium text-brand-red">*</span> are required. Your email address is
          never published.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-brand-charcoal">Your rating</span>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-body" className="text-sm font-medium text-brand-charcoal">
          Your review <span className="text-brand-red">*</span>
        </label>
        <textarea
          id="review-body"
          required
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-lg border border-brand-charcoal/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-name" className="text-sm font-medium text-brand-charcoal">
          Name <span className="text-brand-red">*</span>
        </label>
        <input
          id="review-name"
          type="text"
          required
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="rounded-lg border border-brand-charcoal/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-email" className="text-sm font-medium text-brand-charcoal">
          Email <span className="text-brand-red">*</span>
        </label>
        <input
          id="review-email"
          type="email"
          required
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          className="rounded-lg border border-brand-charcoal/15 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-charcoal/20 disabled:text-brand-charcoal/50"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}

// `reviews` is the APPROVED-only list the PDP already fetched (see GET
// /products/:slug — PENDING ones never reach the storefront). New
// 4-5 star submissions are appended optimistically via onSubmitted so they
// appear immediately without a full page reload; a 1-3 star submission
// instead shows the "pending moderation" message from ReviewForm and is NOT
// appended here, since it genuinely isn't visible yet.
export default function ReviewsSection({ productSlug, reviews: initialReviews }) {
  const [reviews, setReviews] = useState(initialReviews);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-xl font-semibold text-brand-charcoal sm:text-2xl">
          Reviews ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-brand-charcoal/60">There are no reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-col gap-1.5 border-b border-brand-charcoal/10 pb-5 last:border-0">
                <ReviewStars rating={review.rating} />
                <p className="text-sm leading-relaxed text-brand-charcoal/85">{review.body}</p>
                <p className="text-xs text-brand-charcoal/50">
                  <span className="font-semibold text-brand-charcoal/70">{review.authorName}</span>
                  {" · "}
                  {formatReviewDate(review.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReviewForm
        productSlug={productSlug}
        onSubmitted={(review) => setReviews((prev) => [{ ...review, authorName: review.authorName }, ...prev])}
      />
    </div>
  );
}

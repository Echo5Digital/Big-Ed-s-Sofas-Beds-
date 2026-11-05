import { Star, StarHalf } from "lucide-react";

// showValue is opt-in (default off) so existing callers — the shared
// ProductCard used on /shop, product detail, search, wishlist — keep their
// current star-only look. Only the homepage sections that pass a
// generated rating (see lib/dailyRotation.js) turn it on.
export default function StarRating({ rating, reviewCount, size = "sm", showValue = false }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  const starSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Rated ${rating} out of 5 stars`}>
      <div className="flex items-center text-brand-gold">
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`full-${i}`} className={starSize} fill="currentColor" strokeWidth={0} />
        ))}
        {hasHalf && <StarHalf className={starSize} fill="currentColor" strokeWidth={0} />}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`empty-${i}`} className={`${starSize} text-brand-charcoal/20`} fill="currentColor" strokeWidth={0} />
        ))}
      </div>
      {showValue && <span className="text-xs font-semibold text-brand-charcoal">{rating.toFixed(1)}</span>}
      {typeof reviewCount === "number" && (
        <span className="text-xs text-brand-charcoal/60">({reviewCount})</span>
      )}
    </div>
  );
}

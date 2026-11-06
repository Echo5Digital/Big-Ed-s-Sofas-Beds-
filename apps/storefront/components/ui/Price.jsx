import { formatCurrency } from "@/utils/formatCurrency";

const SIZE_STYLES = {
  default: { price: "text-lg", compareAt: "text-sm", off: "text-sm" },
  sm: { price: "text-sm", compareAt: "text-xs", off: "text-xs" },
};

// showDiscount surfaces a "X% Off" label next to the strikethrough price —
// opt-in (default off) so existing callers (cart lines, PDP main price) keep
// their current look; only the denser card/listing contexts turn it on.
export default function Price({ price, compareAtPrice, size = "default", showDiscount = false }) {
  const styles = SIZE_STYLES[size] ?? SIZE_STYLES.default;
  const discountPercent =
    showDiscount && compareAtPrice && compareAtPrice > price
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={`${styles.price} font-bold text-brand-charcoal`}>{formatCurrency(price)}</span>
      {compareAtPrice && (
        <span className={`${styles.compareAt} text-brand-charcoal/40 line-through`}>
          {formatCurrency(compareAtPrice)}
        </span>
      )}
      {discountPercent !== null && discountPercent > 0 && (
        <span className={`${styles.off} font-semibold text-green-700`}>{discountPercent}% Off</span>
      )}
    </div>
  );
}

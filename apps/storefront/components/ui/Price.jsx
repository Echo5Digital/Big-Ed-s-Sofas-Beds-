import { formatCurrency } from "@/utils/formatCurrency";

export default function Price({ price, compareAtPrice }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-bold text-brand-charcoal">{formatCurrency(price)}</span>
      {compareAtPrice && (
        <span className="text-sm text-brand-charcoal/40 line-through">
          {formatCurrency(compareAtPrice)}
        </span>
      )}
    </div>
  );
}

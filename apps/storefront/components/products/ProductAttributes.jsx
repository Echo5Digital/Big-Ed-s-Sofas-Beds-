// Product-level display attributes set in the admin "Item details" section.
// Each is optional on the Product model and simply omitted here when unset —
// never rendered as an empty/placeholder row.
const ATTRIBUTE_LABELS = [
  { key: "itemName", label: "Item Name" },
  { key: "color", label: "Color" },
  { key: "material", label: "Material" },
  { key: "dimensions", label: "Dimensions" },
];

export default function ProductAttributes({ product }) {
  const rows = ATTRIBUTE_LABELS.filter(({ key }) => product[key]);
  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-brand-charcoal/10 bg-white p-4 sm:grid-cols-2">
      {rows.map(({ key, label }) => (
        <div key={key} className="flex items-baseline justify-between gap-3 text-sm sm:justify-start">
          <dt className="font-semibold text-brand-charcoal/60">{label}:</dt>
          <dd className="text-brand-charcoal">{product[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

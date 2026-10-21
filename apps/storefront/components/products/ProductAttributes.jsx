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
    <dl className="flex flex-col gap-1.5 border-b border-brand-charcoal/10 pb-4 text-sm">
      {rows.map(({ key, label }) => (
        <div key={key} className="flex gap-1.5">
          <dt className="font-semibold text-brand-charcoal">{label}:</dt>
          <dd className="text-brand-charcoal/75">{product[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-xl font-bold text-brand-charcoal sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-brand-charcoal/60">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-black/10 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-2xl font-bold text-brand-charcoal sm:text-3xl">{value}</span>
      <span className="text-sm text-brand-charcoal/60">{label}</span>
      {hint && <span className="text-xs text-brand-charcoal/40">{hint}</span>}
    </Card>
  );
}

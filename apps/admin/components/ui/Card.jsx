export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-black/10 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

const STAT_ICON_TONES = {
  default: "bg-brand-charcoal/5 text-brand-charcoal",
  red: "bg-brand-red/10 text-brand-red",
  gold: "bg-brand-gold/15 text-brand-gold-dark",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-2xl font-bold text-brand-charcoal sm:text-3xl">{value}</span>
        <span className="text-sm text-brand-charcoal/60">{label}</span>
        {hint && <span className="text-xs text-brand-charcoal/40">{hint}</span>}
      </div>
      {Icon && (
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${STAT_ICON_TONES[tone]}`}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      )}
    </Card>
  );
}

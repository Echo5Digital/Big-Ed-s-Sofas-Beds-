const STYLES = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  gold: "bg-brand-gold/15 text-brand-gold-dark",
};

export default function Badge({ children, tone = "default" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[tone] ?? STYLES.default}`}>
      {children}
    </span>
  );
}

const STYLES = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

const DOT_STYLES = {
  default: "bg-gray-500",
  success: "bg-green-600",
  warning: "bg-amber-600",
  danger: "bg-red-600",
  info: "bg-blue-600",
};

export default function Badge({ children, tone = "default", dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[tone] ?? STYLES.default}`}>
      {dot && <span className={`size-1.5 rounded-full ${DOT_STYLES[tone] ?? DOT_STYLES.default}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

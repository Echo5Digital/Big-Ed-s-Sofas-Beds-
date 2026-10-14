const VARIANTS = {
  primary: "bg-brand-red text-white hover:bg-brand-red-dark",
  gold: "bg-brand-gold text-brand-charcoal hover:bg-brand-gold-dark",
  outline: "bg-white text-brand-charcoal border border-black/15 hover:bg-gray-50",
  ghost: "bg-transparent text-brand-charcoal hover:bg-black/5",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-4 text-base",
};

export default function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  onClick,
  icon: Icon,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

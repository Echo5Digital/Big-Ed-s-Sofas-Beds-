const VARIANTS = {
  primary: "bg-brand-red text-white shadow-sm shadow-brand-red/20 hover:bg-brand-red-dark active:scale-[0.98]",
  gold: "bg-brand-gold text-brand-charcoal shadow-sm shadow-brand-gold/30 hover:bg-brand-gold-dark active:scale-[0.98]",
  outline: "bg-white text-brand-charcoal border border-black/15 hover:border-black/25 hover:bg-brand-cream/60 active:scale-[0.98]",
  ghost: "bg-transparent text-brand-charcoal hover:bg-black/5 active:scale-[0.98]",
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

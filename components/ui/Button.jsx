import Link from "next/link";

const VARIANTS = {
  primary:
    "bg-brand-red text-white hover:bg-brand-red-dark focus-visible:outline-brand-red-dark",
  gold: "bg-brand-gold text-brand-charcoal hover:bg-brand-gold-dark focus-visible:outline-brand-gold-dark",
  outline:
    "bg-transparent text-brand-charcoal border border-brand-charcoal/30 hover:bg-brand-charcoal/5 focus-visible:outline-brand-charcoal",
};

const SIZES = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function Button({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  icon: Icon,
  iconPosition = "right",
  ...props
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  const content = (
    <>
      {Icon && iconPosition === "left" && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
      {Icon && iconPosition === "right" && <Icon className="size-4 shrink-0" aria-hidden="true" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} {...props}>
      {content}
    </button>
  );
}

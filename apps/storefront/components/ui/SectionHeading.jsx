export default function SectionHeading({
  title,
  subtitle,
  align = "left",
  action,
  className = "",
}) {
  const alignment = align === "center" ? "text-center items-center" : "text-left items-start";

  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className={`flex flex-col gap-1.5 ${alignment}`}>
        <h2 className="font-serif-heading text-2xl font-bold tracking-tight text-brand-charcoal sm:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-brand-charcoal/70 sm:text-base">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

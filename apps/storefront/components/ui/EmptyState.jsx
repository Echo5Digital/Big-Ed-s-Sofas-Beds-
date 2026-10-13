import Button from "@/components/ui/Button";

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-brand-charcoal/20 bg-white px-6 py-14 text-center">
      {Icon && (
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-cream text-brand-red">
          <Icon className="size-7" aria-hidden="true" />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold text-brand-charcoal sm:text-xl">{title}</h2>
        {description && <p className="max-w-sm text-sm text-brand-charcoal/60">{description}</p>}
      </div>
      {actionLabel && actionHref && (
        <Button href={actionHref} variant="primary" size="md" className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

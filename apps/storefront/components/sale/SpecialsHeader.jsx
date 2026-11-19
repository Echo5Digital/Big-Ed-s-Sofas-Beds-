// The title bar that opens each "… Specials" section of the
// /grand-opening-sale page: a red eyebrow label, icon tile + heading, and a
// tagline, closed off with a heavier red-accented divider — restyled off
// the former navy/gold gradient bar and italic type onto the site's normal
// brand tokens (brand-red, brand-charcoal, font-display), and onto the same
// eyebrow-label convention ImageCarousel.jsx uses, so the two read as one
// designed section rather than a plain heading sitting above an unrelated
// carousel.
export default function SpecialsHeader({ id, icon: Icon, title, count, tagline }) {
  return (
    <div className="pb-5">
      <p className="font-display text-xs font-bold tracking-[0.2em] text-brand-red uppercase">Grand Opening</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-red/10 text-brand-red ring-1 ring-brand-red/15 sm:size-12">
            <Icon className="size-6" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <h2 id={id} className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">
            {title}
            {count > 0 && <span className="ml-2 text-brand-charcoal/40">({count})</span>}
          </h2>
        </div>
        <p className="text-sm font-medium text-brand-charcoal/60 sm:text-base">{tagline}</p>
      </div>
      <div className="mt-5 h-px w-full bg-linear-to-r from-brand-red via-brand-charcoal/10 to-transparent" aria-hidden="true" />
    </div>
  );
}

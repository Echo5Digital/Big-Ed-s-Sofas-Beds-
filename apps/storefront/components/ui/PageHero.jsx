import Container from "@/components/ui/Container";
import BearMascot from "@/components/ui/BearMascot";

// Shared page-top banner, matching the dark hero style originally built for
// /about (bg-brand-charcoal, gold title, white subtitle). The homepage's
// HeroBanner is a distinct, larger component and is intentionally left
// untouched — this is for every other page's title block.
export default function PageHero({ title, subtitle, showMascot = true, mascotPose = "wave" }) {
  return (
    <section className="bg-brand-charcoal py-12 sm:py-16">
      <Container className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
        {showMascot && (
          <BearMascot className="h-28 w-28 shrink-0 drop-shadow-xl sm:h-32 sm:w-32" pose={mascotPose} />
        )}
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-gold sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">{subtitle}</p>}
        </div>
      </Container>
    </section>
  );
}

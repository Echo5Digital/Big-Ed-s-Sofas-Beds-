import { Gem, MapPin, Truck, CreditCard } from "lucide-react";
import Container from "@/components/ui/Container";

// The 4 items previously lived as plain text in the top AnnouncementBar
// strip (hidden below md, easy to miss), then as a plain white band under
// the hero. Redesigned here to visually blend INTO the hero instead of
// reading as a separate section: a dark glass panel in the hero's own
// charcoal/gold palette, pulled up with a negative margin so it overlaps the
// hero's bottom edge rather than sitting below a hard section break. Each
// item gets its own accent color (gold/red/cream/gold-dark) so the row reads
// as four distinct badges, not four copies of one icon in different text.
const ITEMS = [
  { icon: Gem, label: "Quality Furniture", accent: "text-brand-gold", ring: "ring-brand-gold/30", chip: "bg-brand-gold/15" },
  { icon: MapPin, label: "Local Showroom", accent: "text-brand-red", ring: "ring-brand-red/30", chip: "bg-brand-red/15" },
  { icon: Truck, label: "Fast Delivery", accent: "text-white", ring: "ring-white/25", chip: "bg-white/10" },
  { icon: CreditCard, label: "Flexible Financing", accent: "text-brand-gold-dark", ring: "ring-brand-gold-dark/30", chip: "bg-brand-gold-dark/15" },
];

export default function TrustStrip() {
  return (
    <div className="relative z-10 px-4 sm:px-6 lg:px-10">
      <Container className="px-0">
        {/* The overlap-the-hero treatment only works where the hero has
            genuine empty space at the bottom for the panel to sit over — the
            desktop layout does (plain charcoal below the copy column); the
            stacked mobile/tablet hero is much shorter and packed edge to
            edge with the CTA buttons, so pulling this up there would cover
            them. Plain, non-overlapping placement below lg. */}
        <div className="rounded-2xl border border-white/10 bg-brand-charcoal-soft/90 shadow-xl backdrop-blur lg:-mt-12">
          <div className="grid grid-cols-2 divide-y divide-white/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {ITEMS.map(({ icon: Icon, label, accent, ring, chip }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-4 sm:justify-center sm:px-3 sm:py-5">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ring-1 sm:size-11 ${chip} ${ring}`}
                >
                  <Icon className={`size-5 sm:size-5.5 ${accent}`} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-white sm:text-base">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}

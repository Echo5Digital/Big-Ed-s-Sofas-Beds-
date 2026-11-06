import Image from "next/image";
import Container from "@/components/ui/Container";

// Storefront Trust & Service Ribbon:
// Full-width grounding section with a signature gold accent border, official
// Big Ed illustrated mascot badges, and structured micro-content that smoothly
// bridges the hero banner to the rest of the page.
const ITEMS = [
  {
    image: "/Quality_furniture_BigEd.webp",
    alt: "Big Ed Quality Furniture Mascot",
    tag: "Verified Quality",
    label: "Quality Furniture",
    description: "Built for everyday comfort & durability",
  },
  {
    image: "/Local_showroom_BigEd.webp",
    alt: "Big Ed Local Showroom Mascot",
    tag: "One Big Location",
    label: "Local Showroom",
    description: "Touch, feel & try before you buy",
  },
  {
    image: "/Fast_delivery_BigEd.webp",
    alt: "Big Ed Fast Delivery Mascot",
    tag: "Doorstep Care",
    label: "Fast Delivery",
    description: "Carefully brought right to your room",
  },
  {
    image: "/Flexible_finance_BigEd.webp",
    alt: "Big Ed Flexible Financing Mascot",
    tag: "Easy Approval",
    label: "Flexible Financing",
    description: "Low monthly payment plans available",
  },
];

export default function TrustStrip() {
  return (
    <section className="relative z-10 border-t-2 border-brand-gold border-b border-brand-charcoal/10 bg-white shadow-xs">
      <Container>
        <div className="grid grid-cols-1 divide-y divide-brand-charcoal/10 sm:grid-cols-2 sm:divide-y-0 sm:gap-x-6 sm:gap-y-4 lg:grid-cols-4 lg:divide-x lg:gap-0">
          {ITEMS.map(({ image, alt, tag, label, description }) => (
            <div
              key={label}
              className="group flex items-center justify-start lg:justify-center py-4 sm:py-5 lg:px-4 xl:px-6 transition-colors hover:bg-brand-cream/30"
            >
              <div className="flex items-center gap-3.5 sm:gap-4">
                <div className="relative size-14 sm:size-16 shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <Image
                    src={image}
                    alt={alt}
                    fill
                    sizes="(max-width: 640px) 56px, 64px"
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold-dark">
                    {tag}
                  </span>
                  <span className="text-base font-extrabold text-brand-charcoal leading-snug">
                    {label}
                  </span>
                  <span className="text-xs text-brand-charcoal/65 leading-tight mt-0.5">
                    {description}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

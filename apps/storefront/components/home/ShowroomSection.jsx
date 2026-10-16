import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

// Natural aspect ratios (width/height) from each source file — the badges
// are wide ovals, not squares, so width/height must track the real images
// or next/image distorts them to fit a square box.
const features = [
  { id: "inventory", label: "Large In-Stock Inventory", icon: "/inventory.webp", width: 1606, height: 979 },
  { id: "pickup", label: "In-Store Pickup Available", icon: "/store.webp", width: 1720, height: 914 },
  { id: "delivery", label: "Local Delivery", icon: "/local_delivery.webp", width: 1693, height: 929 },
];

export default function ShowroomSection() {
  return (
    <section className="relative flex min-h-100 items-center overflow-hidden bg-brand-charcoal py-14 sm:min-h-125 sm:py-20">
      <Image
        src="/Big_Ed’s_Sofas_Beds.webp"
        alt="Big Ed's Sofas & Beds storefront exterior"
        fill
        sizes="100vw"
        className="object-cover"
      />

      {/* Diagonal-edged dark panel behind the text column, matching the
          reference design's angled cut rather than a soft gradient fade. */}
      <div
        className="absolute inset-y-0 left-0 w-full bg-brand-charcoal/90 sm:w-[44%]"
        style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, 0 100%)" }}
      />

      <Container className="relative z-10">
        <div className="flex max-w-xl flex-col items-start gap-4 text-left [text-shadow:0_2px_10px_rgb(0_0_0_/_0.85),0_1px_3px_rgb(0_0_0_/_0.9)]">
          <h2 className="font-serif-heading leading-tight font-bold tracking-tight text-white">
            <span className="block text-2xl sm:text-3xl">Visit Our</span>
            <span className="block text-4xl text-brand-gold underline decoration-4 underline-offset-8 sm:text-5xl">
              Showroom
            </span>
          </h2>
          <p className="text-base font-semibold text-brand-gold">One Location. A Bigger Selection.</p>
          <p className="text-sm text-white sm:text-base">
            Explore a wide selection of sofas, sectionals, bedroom sets,
            <br className="hidden sm:block" /> mattresses, recliners, dining sets and more &mdash; all in one place!
          </p>

          <ul className="mt-2 flex flex-col gap-3">
            {features.map(({ id, label, icon, width, height }) => (
              <li key={id} className="flex items-center gap-3 text-sm font-semibold text-white">
                <Image src={icon} alt="" width={width} height={height} className="h-9 w-auto shrink-0" />
                <span className="h-6 w-px shrink-0 bg-white/30" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <Button
            href="/contact"
            variant="gold"
            size="lg"
            icon={ArrowRight}
            iconPosition="right"
            className="mt-4 text-shadow-none"
          >
            Get Directions
          </Button>
        </div>
      </Container>
    </section>
  );
}

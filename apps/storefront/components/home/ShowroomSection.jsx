import Image from "next/image";
import { Boxes, PackageCheck, Truck, MapPin } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

const features = [
  { id: "inventory", label: "Large In-Stock Inventory", icon: Boxes },
  { id: "pickup", label: "In-Store Pickup Available", icon: PackageCheck },
  { id: "delivery", label: "Local Delivery", icon: Truck },
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
      <Container className="relative z-10">
        <div className="flex max-w-xl flex-col items-start gap-4 text-left [text-shadow:0_2px_10px_rgb(0_0_0_/_0.85),0_1px_3px_rgb(0_0_0_/_0.9)]">
          <h2 className="font-serif-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Visit Our Showroom
          </h2>
          <p className="text-base font-semibold text-brand-gold">One Location. A Bigger Selection.</p>
          <p className="text-sm text-white sm:text-base">
            Explore a wide selection of sofas, sectionals, bedroom sets,
            <br className="hidden sm:block" /> mattresses, recliners, dining sets and more &mdash; all in one place.
          </p>

          <ul className="mt-2 flex flex-col gap-3">
            {features.map(({ id, label, icon: Icon }) => (
              <li key={id} className="flex items-center gap-3 text-sm font-semibold text-white">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/90 text-brand-charcoal shadow-[0_2px_8px_rgb(0_0_0_/_0.6)]">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          <Button
            href="/contact"
            variant="gold"
            size="lg"
            icon={MapPin}
            iconPosition="left"
            className="mt-4 text-shadow-none"
          >
            Get Directions
          </Button>
        </div>
      </Container>
    </section>
  );
}

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
      <div className="absolute inset-0 bg-brand-charcoal/70 sm:bg-linear-to-r sm:from-brand-charcoal sm:via-brand-charcoal/85 sm:to-brand-charcoal/40" />

      <Container className="relative z-10">
        <div className="flex max-w-xl flex-col items-start gap-4 text-left">
          <h2 className="font-serif-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Visit Our Showroom
          </h2>
          <p className="text-base font-semibold text-brand-gold">One Location. A Bigger Selection.</p>
          <p className="text-sm text-white/80 sm:text-base">
            Explore a wide selection of sofas, sectionals, bedroom sets, mattresses, recliners,
            dining sets and more &mdash; all in one place.
          </p>

          <ul className="mt-2 flex flex-col gap-3">
            {features.map(({ id, label, icon: Icon }) => (
              <li key={id} className="flex items-center gap-3 text-sm font-semibold text-white">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/25 text-brand-gold">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          <Button href="/contact" variant="gold" size="lg" icon={MapPin} iconPosition="left" className="mt-4">
            Get Directions
          </Button>
        </div>
      </Container>
    </section>
  );
}

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
    <section className="bg-brand-cream py-14 sm:py-16">
      <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-md">
            <Image
              src="/images/showroom/showroom-interior-main.jpg"
              alt="Leather sectional sofa on display in the Big Ed's Sofas & Beds showroom"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-8 -right-4 hidden w-48 -rotate-3 overflow-hidden rounded-xl border-4 border-white shadow-lg sm:block md:w-56">
            <div className="relative aspect-4/3">
              <Image
                src="https://images.unsplash.com/photo-1567016432779-094069958ea5?w=500&h=375&fit=crop&q=80"
                alt="Showroom interior with furniture on display"
                fill
                sizes="224px"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 pt-6 lg:pt-0">
          <h2 className="font-serif-heading text-2xl font-bold tracking-tight text-brand-charcoal sm:text-3xl">
            Visit Our Showroom
          </h2>
          <p className="text-base font-semibold text-brand-red-dark">One Location. A Bigger Selection.</p>
          <p className="text-sm text-brand-charcoal/70 sm:text-base">
            Explore a wide selection of sofas, sectionals, bedroom sets, mattresses, recliners,
            dining sets and more &mdash; all in one place.
          </p>

          <ul className="mt-2 flex flex-col gap-3">
            {features.map(({ id, label, icon: Icon }) => (
              <li key={id} className="flex items-center gap-3 text-sm font-semibold text-brand-charcoal">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/25 text-brand-gold-dark">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          <Button href="/contact" variant="primary" size="lg" icon={MapPin} iconPosition="left" className="mt-4">
            Get Directions
          </Button>
        </div>
      </Container>
    </section>
  );
}

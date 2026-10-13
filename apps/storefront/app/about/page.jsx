import Image from "next/image";
import { MapPin, Phone, Clock, Heart, Handshake, Sparkles } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import BearMascot from "@/components/ui/BearMascot";
import { siteConfig } from "@/lib/mock-data/site-config";

export const metadata = {
  title: "About Us | Big Ed's Sofas & Beds",
  description: "Learn about Big Ed's Sofas & Beds, our showroom in Lake Wales, FL, and what we stand for.",
};

const values = [
  {
    icon: Heart,
    title: "Comfort First",
    description: "We believe furniture should be lived on, not just looked at. Comfort guides every piece we choose to carry.",
  },
  {
    icon: Handshake,
    title: "Honest Value",
    description: "Quality furniture shouldn't require a luxury budget. We work to keep prices fair without cutting corners.",
  },
  {
    icon: Sparkles,
    title: "Local & Hands-On",
    description: "As a local showroom, we get to know our customers and stand behind what we sell.",
  },
];

export default function AboutPage() {
  return (
    <div className="pb-10">
      <section className="bg-brand-charcoal py-12 sm:py-16">
        <Container className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
          <BearMascot className="h-28 w-28 shrink-0 drop-shadow-xl sm:h-32 sm:w-32" pose="wave" />
          <div>
            <h1 className="font-display text-3xl font-bold text-brand-gold sm:text-4xl">
              Big Comfort. Bigger Savings.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              Big Ed&rsquo;s Sofas &amp; Beds is a local furniture showroom built around one idea:
              everyone deserves a comfortable home without an uncomfortable price tag.
            </p>
          </div>
        </Container>
      </section>

      <Container className="mt-10">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />

        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold text-brand-charcoal">Our Story</h2>
            <p className="text-sm text-brand-charcoal/75 sm:text-base">
              Big Ed&rsquo;s Sofas &amp; Beds started with a simple goal: fill a showroom with
              furniture that looks great, holds up to real life, and doesn&rsquo;t cost a fortune.
              From sofas and sectionals to bedroom sets, mattresses and dining sets, we&rsquo;ve built
              a selection for every room in the house.
            </p>
            <p className="text-sm text-brand-charcoal/75 sm:text-base">
              We keep a large in-stock inventory so you&rsquo;re not stuck waiting months for a
              special order, and our team is happy to help you measure, compare, and plan financing
              that fits your budget.
            </p>
          </div>

          <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-md">
            <Image
              src="/images/showroom/showroom-interior-main.jpg"
              alt="Furniture on display inside the Big Ed's Sofas & Beds showroom"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-14">
          <h2 className="text-center font-display text-2xl font-semibold text-brand-charcoal">
            What We Stand For
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {values.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex flex-col items-center gap-3 rounded-xl border border-brand-charcoal/10 bg-white p-6 text-center">
                <Icon className="size-8 text-brand-red" aria-hidden="true" strokeWidth={1.75} />
                <h3 className="font-display text-base font-semibold text-brand-charcoal">{title}</h3>
                <p className="text-sm text-brand-charcoal/70">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 rounded-2xl border border-brand-charcoal/10 bg-white p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-charcoal">Visit Our Showroom</h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-brand-charcoal/75">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                <span>
                  {siteConfig.address.line1}
                  <br />
                  {siteConfig.address.line2}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-brand-red" aria-hidden="true" />
                <a href={siteConfig.phoneHref} className="hover:text-brand-red-dark">
                  {siteConfig.phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                <span>
                  {siteConfig.hours.map((h) => (
                    <span key={h.days} className="block">
                      {h.days}: {h.time}
                    </span>
                  ))}
                </span>
              </li>
            </ul>
            <Button href="/contact" variant="primary" size="md" className="mt-5">
              Get Directions &amp; Contact Info
            </Button>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-brand-charcoal">
              In the Neighborhood?
            </h2>
            <p className="mt-2 text-sm text-brand-charcoal/70">
              Stop by to sit on our sofas, test our mattresses, and talk through financing in person.
              No appointment needed during regular business hours.
            </p>
            <Button href="/shop" variant="outline" size="md" className="mt-5">
              Browse Our Catalog First
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}

import Image from "next/image";
import { MapPin, Phone, Clock, Heart, Handshake, Sparkles } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { siteConfig } from "@/lib/mock-data/site-config";

export const metadata = {
  title: "About Us | Big Ed's Sofas & Beds",
  description: "Learn about Big Ed's Sofas & Beds, our showroom in Houston, TX, and what we stand for.",
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
      {/* Image-background hero, same technique as SaleHeader
          (components/sale/SaleHeader.jsx) for a wide (2048x768) banner image:
          the section takes the image's own aspect ratio so object-cover
          never over-crops it, with a min-height floor below sm so it doesn't
          get too short to read on narrow phones. The image's plain wall
          spans the full left ~45% of the frame at any height, so copy stays
          left-aligned and vertically centered at every breakpoint — the
          gradient direction is the only thing that changes (top-to-bottom
          below sm, where the crop is short/wide and that's the stronger
          axis; left-to-right at sm+ to match the image's own layout). */}
      <section className="relative min-h-80 overflow-hidden bg-brand-charcoal sm:aspect-8/3 sm:min-h-0">
        <div className="absolute inset-0 h-full w-full">
          <Image
            src="/About_US_Big_EDs.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-charcoal/85 via-brand-charcoal/35 to-transparent sm:bg-gradient-to-r sm:from-brand-charcoal/80 sm:via-brand-charcoal/45 sm:to-transparent" />
        </div>

        <Container className="relative flex h-full min-h-80 flex-col items-start justify-center gap-2 py-8 text-left sm:gap-3 sm:py-10">
          <h1 className="max-w-52 font-display text-2xl leading-tight font-bold text-brand-gold drop-shadow-md sm:max-w-xl sm:text-4xl lg:text-5xl">
            Big Comfort. Bigger Savings.
          </h1>
          <p className="max-w-60 text-xs leading-snug text-white/90 drop-shadow-md sm:max-w-xl sm:text-base lg:text-lg">
            Big Ed&rsquo;s Sofas &amp; Beds is a local furniture showroom built around one idea:
            everyone deserves a comfortable home without an uncomfortable price tag.
          </p>
        </Container>
      </section>

      <Container className="mt-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
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
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <a href={siteConfig.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-red-dark">
                  {siteConfig.address.line1}
                  <br />
                  {siteConfig.address.line2}
                </a>
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

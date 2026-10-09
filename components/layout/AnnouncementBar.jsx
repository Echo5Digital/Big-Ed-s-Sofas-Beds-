import { Check, Phone } from "lucide-react";
import { siteConfig } from "@/lib/mock-data/site-config";

const benefits = ["Quality Furniture", "Local Showroom", "Fast Delivery", "Flexible Financing"];

export default function AnnouncementBar() {
  return (
    <div className="bg-brand-red-dark text-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-1.5 text-xs sm:px-6 lg:px-10">
        <p className="font-semibold text-brand-gold">{siteConfig.tagline}</p>

        <ul className="hidden flex-wrap items-center gap-x-5 gap-y-1 font-medium md:flex">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-1.5">
              <Check className="size-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <a
          href={siteConfig.phoneHref}
          className="flex items-center gap-1.5 font-semibold tracking-wide whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold rounded"
        >
          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{siteConfig.phone}</span>
        </a>
      </div>
    </div>
  );
}

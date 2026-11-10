import Image from "next/image";
import Link from "next/link";
import { formatCurrency } from "@/utils/formatCurrency";

// Ragged "marker stroke" behind the price. A plain clip-path so it scales with
// whatever text it wraps.
const MARKER_CLIP =
  "polygon(3% 22%, 1% 6%, 12% 0, 30% 7%, 52% 1%, 74% 6%, 92% 0, 99% 13%, 97% 40%, 100% 63%, 98% 92%, 86% 100%, 64% 95%, 40% 100%, 18% 94%, 4% 100%, 0 78%, 2% 50%)";

// default = the homepage doorbuster section (4-up); compact = denser 5-up grids.
const SIZES = {
  default: {
    title: "text-base sm:text-xl",
    subtitle: "text-xs sm:text-sm",
    was: "text-[11px] sm:text-sm",
    price: "text-xl sm:px-7 sm:py-2 sm:text-3xl",
  },
  compact: {
    title: "text-sm sm:text-base xl:text-lg",
    subtitle: "text-[11px] sm:text-xs",
    was: "text-[10px] sm:text-xs",
    price: "text-lg sm:px-5 sm:py-1.5 sm:text-2xl",
  },
};

function discountPercent(price, compareAtPrice) {
  return compareAtPrice && compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
}

// One white "DOORBUSTER" product card. The whole card is the link (there is
// deliberately no separate Shop Now button). Renders an <li>, sized from the
// --cols / --gap CSS variables the parent <ul> sets, so the last row of a
// flex-wrap list can be centred.
//
// deal: { slug, title, subtitle?, image, price, compareAtPrice?,
//         fit? ("cover" | "contain"), position?, zoom? }
export default function DealCard({ deal, size = "default" }) {
  const t = SIZES[size] ?? SIZES.default;
  const savings = discountPercent(deal.price, deal.compareAtPrice);

  return (
    <li className="w-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))]">
      <Link
        href={`/products/${deal.slug}`}
        className="group relative flex h-full flex-col rounded-2xl bg-white p-2.5 shadow-[0_12px_32px_-14px_rgba(20,30,70,0.38)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_40px_-16px_rgba(163,6,16,0.45)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red sm:p-3"
      >
        <span className="absolute -top-2.5 -left-1.5 z-10 -rotate-6 rounded-md bg-linear-to-b from-[#ee1c28] to-[#a30610] px-2.5 py-1 text-[10px] font-black tracking-wide text-white italic shadow-[0_3px_8px_rgba(163,6,16,0.45)] ring-1 ring-white/30 sm:-top-3 sm:-left-2.5 sm:px-3 sm:text-xs">
          DOORBUSTER
        </span>

        <div className="relative aspect-5/4 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
          {/* The wrapper carries the static zoom so the hover zoom on the image
              doesn't fight it. */}
          <div className="absolute inset-0" style={deal.zoom ? { transform: `scale(${deal.zoom})` } : undefined}>
            <Image
              src={deal.image}
              alt={deal.subtitle ? `${deal.title} ${deal.subtitle}` : deal.title}
              fill
              sizes="(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 24vw"
              className={`transition-transform duration-500 group-hover:scale-105 ${
                deal.fit === "contain" ? "object-contain" : "object-cover"
              }`}
              style={{ objectPosition: deal.position ?? "center" }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center pt-3 text-center sm:pt-4">
          <h3 className={`${t.title} line-clamp-2 leading-tight font-extrabold text-[#0b1b4d]`}>{deal.title}</h3>
          {deal.subtitle && (
            <p className={`${t.subtitle} mt-0.5 font-semibold text-[#2b3550]/80`}>{deal.subtitle}</p>
          )}

          <div className="mt-auto flex flex-col items-center pt-3 sm:pt-4">
            {savings > 0 && (
              <p className={`${t.was} mb-1 font-semibold text-[#2b3550]/70`}>
                Was <span className="line-through">{formatCurrency(deal.compareAtPrice)}</span>{" "}
                <span className="font-extrabold text-brand-red">Save {savings}%</span>
              </p>
            )}
            <span
              className={`${t.price} relative isolate inline-block px-5 py-1.5 leading-none font-extrabold text-[#b3000f] italic`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 -rotate-1 bg-linear-to-b from-[#fff27a] via-[#ffdc1f] to-[#ffbf00] drop-shadow-[0_2px_0_rgba(190,120,0,0.35)]"
                style={{ clipPath: MARKER_CLIP }}
              />
              {formatCurrency(deal.price)}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

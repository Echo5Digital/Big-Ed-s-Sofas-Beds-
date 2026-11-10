import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Montserrat } from "next/font/google";
import Container from "@/components/ui/Container";
import { formatCurrency } from "@/utils/formatCurrency";

// Heavy italic geometric face for the headline / prices. Loaded here (like
// PromoTicker's Anton) so only the homepage requests it.
const montserrat = Montserrat({ subsets: ["latin"], style: ["normal", "italic"], display: "swap" });

// Yellow ribbon with swallow-tail ends, and the ragged "marker stroke" behind
// each price. Plain clip-paths so they scale with whatever text they wrap.
const RIBBON_CLIP = "polygon(0 12%, 100% 0, 96.5% 50%, 100% 100%, 0 88%, 3.5% 50%)";
const MARKER_CLIP =
  "polygon(3% 22%, 1% 6%, 12% 0, 30% 7%, 52% 1%, 74% 6%, 92% 0, 99% 13%, 97% 40%, 100% 63%, 98% 92%, 86% 100%, 64% 95%, 40% 100%, 18% 94%, 4% 100%, 0 78%, 2% 50%)";

// Decorative confetti around the headline: [position, size, colour, rotation].
const CONFETTI = [
  ["left-[27%] top-[6%]", "h-1.5 w-4", "bg-[#2f6bff]", "rotate-[-28deg]"],
  ["left-[31%] top-[2%]", "h-1.5 w-1.5", "bg-[#ffc400]", "rotate-12"],
  ["left-[33%] top-[14%]", "h-4 w-1.5", "bg-[#ff9d1c]", "rotate-[25deg]"],
  ["left-[24%] top-[20%]", "h-1.5 w-3.5", "bg-[#a855f7]", "rotate-[18deg]"],
  ["left-[88%] top-[3%]", "h-4 w-1.5", "bg-[#ff9d1c]", "rotate-[35deg]"],
  ["left-[92%] top-[9%]", "h-1.5 w-4", "bg-[#2f6bff]", "rotate-[-20deg]"],
  ["left-[86%] top-[16%]", "h-1.5 w-1.5", "bg-[#ffc400]", "rotate-12"],
  ["left-[95%] top-[22%]", "h-1.5 w-3.5", "bg-[#a855f7]", "rotate-[40deg]"],
  ["left-[90%] top-[28%]", "h-4 w-1.5", "bg-[#2f6bff]", "rotate-[-30deg]"],
];

function discountPercent(price, compareAtPrice) {
  return compareAtPrice && compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
}

function DealCard({ deal }) {
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
              alt={`${deal.title} ${deal.subtitle}`}
              fill
              sizes="(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 24vw"
              className={`transition-transform duration-500 group-hover:scale-105 ${
                deal.fit === "contain" ? "object-contain" : "object-cover"
              }`}
              style={{ objectPosition: deal.position }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center pt-3 text-center sm:pt-4">
          <h3 className="text-base leading-tight font-extrabold text-[#0b1b4d] sm:text-xl">{deal.title}</h3>
          <p className="mt-0.5 text-xs font-semibold text-[#2b3550]/80 sm:text-sm">{deal.subtitle}</p>

          <div className="mt-auto flex flex-col items-center pt-3 sm:pt-4">
            {savings > 0 && (
              <p className="mb-1 text-[11px] font-semibold text-[#2b3550]/70 sm:text-sm">
                Was <span className="line-through">{formatCurrency(deal.compareAtPrice)}</span>{" "}
                <span className="font-extrabold text-brand-red">Save {savings}%</span>
              </p>
            )}
            <span className="relative isolate inline-block px-5 py-1.5 text-xl leading-none font-extrabold text-[#b3000f] italic sm:px-7 sm:py-2 sm:text-3xl">
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

// deals: the already-fetched, already-filtered list from getDoorbusterDeals()
// (lib/doorbusterDeals.js) — products that are missing or out of stock are
// dropped there, so everything rendered here is buyable right now.
export default function DoorbusterDeals({ deals }) {
  if (!deals?.length) return null;

  return (
    <section
      aria-labelledby="doorbuster-heading"
      className={`relative isolate overflow-hidden bg-linear-to-b from-[#fffdf8] via-[#fff7e6] to-[#fdecc8] pt-10 pb-28 sm:pt-14 sm:pb-36 ${montserrat.className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,206,48,0.30),transparent_65%)]"
      />

      <Container className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 hidden h-56 sm:block">
          {CONFETTI.map(([position, size, colour, rotation]) => (
            <span key={position} className={`absolute rounded-[1px] ${position} ${size} ${colour} ${rotation}`} />
          ))}
        </div>

        <header className="relative flex flex-col items-center text-center lg:pl-64 xl:pl-76">
          <div
            aria-hidden="true"
            className="pointer-events-none relative mb-1 w-40 sm:w-52 lg:absolute lg:top-0 lg:left-0 lg:mb-0 lg:w-64 xl:w-88"
          >
            <Image
              src="/images/mascot/big-ed-thumbsup.webp"
              alt=""
              width={1584}
              height={993}
              sizes="(max-width: 1279px) 256px, 352px"
              className="h-auto w-full"
              style={{
                WebkitMaskImage: "linear-gradient(to bottom, #000 78%, transparent)",
                maskImage: "linear-gradient(to bottom, #000 78%, transparent)",
              }}
            />
          </div>

          <p className="flex items-center gap-3 text-base font-extrabold tracking-wide text-brand-red uppercase italic sm:gap-4 sm:text-2xl">
            <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-brand-red sm:w-20 lg:w-28" />
            Grand Opening Sale
            <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-brand-red sm:w-20 lg:w-28" />
          </p>

          <div className="mt-2 rotate-[-1.5deg] drop-shadow-[0_8px_10px_rgba(160,100,0,0.28)] sm:mt-3">
            <div
              className="bg-linear-to-b from-[#ffec6e] via-[#ffd51f] to-[#ffb800] px-9 py-2.5 sm:px-16 sm:py-3.5"
              style={{ clipPath: RIBBON_CLIP }}
            >
              <h2
                id="doorbuster-heading"
                className="text-[1.65rem] leading-tight font-extrabold text-[#0b1b4d] italic text-balance sm:text-4xl xl:text-5xl"
              >
                Featured Doorbuster Deals
              </h2>
            </div>
          </div>

          <p className="mt-3 max-w-3xl text-sm font-semibold text-[#2b3550] italic text-balance sm:mt-4 sm:text-lg lg:text-xl">
            Our Biggest Grand Opening Savings on Customer Favorites!
          </p>
        </header>

        <ul className="relative z-10 mt-9 flex [--cols:2] [--gap:0.75rem] flex-wrap justify-center gap-(--gap) sm:mt-12 sm:[--cols:3] sm:[--gap:1rem] lg:[--cols:4] lg:[--gap:1.25rem]">
          {deals.map((deal) => (
            <DealCard key={deal.slug} deal={deal} />
          ))}
        </ul>

        <div className="relative z-10 mt-10 flex items-center justify-center gap-4 sm:mt-14 sm:gap-6">
          <span
            aria-hidden="true"
            className="hidden h-px max-w-64 flex-1 bg-linear-to-r from-transparent to-brand-red/60 sm:block"
          />
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 bg-linear-to-b from-[#e3101c] to-[#8f050f] px-6 py-3.5 text-base font-extrabold text-white shadow-[0_12px_26px_-8px_rgba(163,6,16,0.75),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red sm:px-9 sm:text-xl"
          >
            Shop All Grand Opening Deals
            <ArrowRight className="size-5 shrink-0 sm:size-6" strokeWidth={2.75} aria-hidden="true" />
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-px max-w-64 flex-1 bg-linear-to-l from-transparent to-brand-red/60 sm:block"
          />
        </div>
      </Container>

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full sm:h-20 lg:h-24"
      >
        <defs>
          <linearGradient id="doorbuster-swoosh-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e3101c" />
            <stop offset="1" stopColor="#8f050f" />
          </linearGradient>
        </defs>
        <path d="M0 58 C 240 14, 540 98, 840 56 S 1260 8, 1440 46 L1440 120 L0 120 Z" fill="#ffc400" />
        <path d="M0 84 C 280 46, 560 112, 900 76 S 1280 40, 1440 70 L1440 120 L0 120 Z" fill="url(#doorbuster-swoosh-red)" />
      </svg>
    </section>
  );
}

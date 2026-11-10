import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BedDouble } from "lucide-react";
import Container from "@/components/ui/Container";
import DealCard from "@/components/home/DealCard";

// A spiky starburst as a clip-path polygon (alternating outer / inner points).
function starClip(points, inner) {
  const coords = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? 50 : 50 * inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    coords.push(`${(50 + radius * Math.cos(angle)).toFixed(1)}% ${(50 + radius * Math.sin(angle)).toFixed(1)}%`);
  }
  return `polygon(${coords.join(", ")})`;
}
const BURST_CLIP = starClip(14, 0.8);

function MoreDealsBanner({ count }) {
  return (
    <div className="relative mt-12 overflow-hidden rounded-3xl bg-linear-to-r from-[#d8ebff] via-white to-[#d8ebff] p-5 shadow-[0_18px_40px_-20px_rgba(10,42,128,0.55)] ring-1 ring-[#0a2a80]/15 sm:mt-16 sm:p-6">
      <div className="flex flex-col items-center gap-5 lg:flex-row lg:justify-between lg:gap-8">
        <div className="flex items-center gap-1 sm:gap-3">
          <div aria-hidden="true" className="relative w-24 shrink-0 sm:w-32">
            <Image
              src="/images/mascot/big-ed-thumbsup.webp"
              alt=""
              width={1584}
              height={993}
              sizes="128px"
              className="h-auto w-full"
              style={{
                WebkitMaskImage: "linear-gradient(to bottom, #000 78%, transparent)",
                maskImage: "linear-gradient(to bottom, #000 78%, transparent)",
              }}
            />
          </div>

          <div aria-hidden="true" className="relative size-32 shrink-0 sm:size-40">
            <span className="absolute inset-0 bg-[#ffc400]" style={{ clipPath: BURST_CLIP }} />
            <span
              className="absolute inset-[5%] bg-linear-to-b from-[#ee1c28] to-[#a30610]"
              style={{ clipPath: BURST_CLIP }}
            />
            <span className="absolute inset-0 grid place-items-center px-5 text-center text-[11px] leading-tight font-black text-white uppercase italic sm:text-sm">
              <span>
                <span className="block text-[#ffe45c] sm:text-base">More</span>
                Doorbuster
                <span className="block text-lg text-[#ffe45c] sm:text-2xl">Deals!</span>
              </span>
            </span>
          </div>
        </div>

        <p className="text-center text-2xl leading-tight font-black text-[#0b1b4d] italic sm:text-3xl lg:text-left">
          {count} Grand Opening Specials
          <span className="mt-1 block text-base font-bold text-[#14246b] sm:text-lg">
            across Beds &amp; Bedroom Sets
          </span>
        </p>

        <Link
          href="/deals"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-white/70 bg-linear-to-b from-[#e3101c] to-[#8f050f] px-6 py-3.5 text-base font-extrabold text-white shadow-[0_12px_26px_-8px_rgba(163,6,16,0.75),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red sm:px-8 sm:text-xl"
        >
          Shop All Grand Opening Deals
          <ArrowRight className="size-5 shrink-0 sm:size-6" strokeWidth={2.75} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

// products: the already-chosen list from getGrandOpeningProducts()
// (lib/grandOpeningSale.js).
export default function SaleProducts({ products }) {
  return (
    <section
      aria-labelledby="sale-products-heading"
      className="relative isolate overflow-hidden bg-linear-to-b from-[#fdecc8] via-[#fffdf8] to-[#fdecc8] pt-10 pb-16 sm:pt-14 sm:pb-24"
    >
      <Container className="relative">
        <div className="flex flex-col gap-3 rounded-2xl bg-linear-to-r from-[#0a2a80] via-[#1346c9] to-[#0a2a80] p-3 shadow-[0_14px_30px_-14px_rgba(10,42,128,0.75)] ring-1 ring-white/20 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-b from-[#ffe45c] to-[#ffb800] text-[#0b1b4d] shadow-md sm:size-14">
              <BedDouble className="size-6 sm:size-8" strokeWidth={2.4} aria-hidden="true" />
            </span>
            <h2 id="sale-products-heading" className="text-[1.3rem] font-black text-white italic sm:text-4xl">
              Bedroom Specials{" "}
              {products.length > 0 && <span className="text-[#ffd43b]">({products.length})</span>}
            </h2>
          </div>
          <p className="rounded-full bg-linear-to-b from-[#ffec6e] to-[#ffc400] px-4 py-2 text-center text-xs font-extrabold text-[#0b1b4d] italic shadow-md sm:text-base">
            Stylish &amp; Comfortable Beds at Grand Opening Prices!
          </p>
        </div>

        {products.length > 0 ? (
          <>
            <ul className="relative z-10 mt-12 flex [--cols:2] [--gap:0.75rem] flex-wrap justify-center gap-(--gap) sm:[--cols:3] sm:[--gap:1rem] lg:[--cols:4] lg:[--gap:1.25rem] xl:[--cols:5]">
              {products.map((product) => (
                <DealCard key={product.slug} deal={product} size="compact" />
              ))}
            </ul>
            <MoreDealsBanner count={products.length} />
          </>
        ) : (
          <p className="mt-12 text-center text-lg font-semibold text-[#14246b]">
            Our Grand Opening specials are being restocked &mdash; check back shortly, or{" "}
            <Link href="/shop/bedroom" className="text-brand-red underline underline-offset-4">
              browse all bedroom furniture
            </Link>
            .
          </p>
        )}
      </Container>
    </section>
  );
}

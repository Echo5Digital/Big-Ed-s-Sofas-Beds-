import Image from "next/image";

// The Grand Opening "Door Buster" flyers, shown as an endlessly scrolling strip.
// The flyers carry their own prices/SKUs in the artwork, so they are plain
// images (not linked to a live product). Order is the order they are shown in.
// Files are the ~100 KB JPEG exports in /public.
const FLYERS = [
  {
    src: "/1000008222-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Cotter Collection queen bed",
  },
  {
    src: "/1000008225-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Ted Collection upholstered queen bed",
  },
  {
    src: "/1000008247-100kb.jpeg",
    width: 1500,
    height: 1000,
    alt: "Grand Opening Door Buster: Lus Collection 4-piece bedroom set",
  },
  {
    src: "/1000008237-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Phyll Collection reclining chair and two-piece sofa and loveseat with cup holders",
  },
  {
    src: "/1000008221-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Heir Collection queen platform bed, available in two colors",
  },
  {
    src: "/1000008231-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Accent Collection power lift chair in brown",
  },
  {
    src: "/1000008276-100kb.jpeg",
    width: 1500,
    height: 1000,
    alt: "Grand Opening Door Buster: Radiance Collection power recliner and sofa and loveseat set",
  },
  {
    src: "/1000008229-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Beech Collection queen bed",
  },
  {
    src: "/1000008280-100kb.jpeg",
    width: 1500,
    height: 1000,
    alt: "Grand Opening Door Buster: Glisslyn Collection five-piece table set",
  },
  {
    src: "/1000008235-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Blush Collection two-piece reversible sectional in pink velvet with matching ottoman",
  },
  {
    src: "/1000008233-100kb.jpeg",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Ela Collection two-piece reversible sectional with pullout bed",
  },
  {
    src: "/1000008278-100kb.jpeg",
    width: 1500,
    height: 1000,
    alt: "Grand Opening Door Buster: Ramoan Collection three-piece power reclining sectional",
  },
];

// The loop works like the homepage ticker: two identical groups side by side,
// the track slides left by exactly one group (see .marquee-* in globals.css),
// so the end of the animation is indistinguishable from its start. Each group
// holds the flyers twice, so even on a wide screen it is wider than the
// viewport and no gap ever shows. Copies other than the first set are
// aria-hidden so each flyer is announced once.
//
// Every flyer loads eagerly: browser lazy-loading doesn't reliably kick in for
// images inside a clipped, animating strip, which left empty frames sliding
// past. The files are small (~100 KB) and the repeated copies share one request.
function FlyerSet({ decorative = false, repeat = false }) {
  return (
    <ul
      aria-hidden={decorative || undefined}
      className={`marquee-set flex shrink-0 items-center gap-4 pr-4 sm:gap-6 sm:pr-6 ${repeat ? "marquee-dup" : ""}`}
    >
      {FLYERS.map((flyer, index) => (
        <li key={flyer.src} className="shrink-0">
          <Image
            src={flyer.src}
            alt={decorative ? "" : flyer.alt}
            width={flyer.width}
            height={flyer.height}
            sizes={flyer.width > flyer.height ? "(max-width: 640px) 432px, 624px" : "(max-width: 640px) 264px, 380px"}
            loading="eager"
            className={`h-72 w-auto rounded-2xl shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] ring-2 ring-white/25 sm:h-80 lg:h-104 ${
              index % 2 ? "rotate-[1.2deg]" : "rotate-[-1.2deg]"
            }`}
          />
        </li>
      ))}
    </ul>
  );
}

function Group({ decorative = false }) {
  return (
    <div
      aria-hidden={decorative || undefined}
      className={`marquee-group flex min-w-screen shrink-0 items-center justify-around py-4 ${decorative ? "marquee-dup" : ""}`}
    >
      <FlyerSet decorative={decorative} />
      <FlyerSet decorative repeat />
    </div>
  );
}

// One full pass takes longer the more flyers there are, so the strip keeps the
// same scroll speed as it grows (~13.5s per flyer).
const MARQUEE_DURATION = `${FLYERS.length * 13.5}s`;

export default function PromoMarquee() {
  return (
    <section
      aria-label="Grand Opening Door Buster flyers"
      className="relative isolate overflow-hidden border-y-4 border-[#ffcf33] bg-linear-to-b from-[#0a1744] via-[#10286b] to-[#0a1744] py-8 sm:py-12"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_50%,rgba(60,110,255,0.35),transparent_70%)]"
      />

      <p
        aria-hidden="true"
        className="mb-4 flex items-center justify-center gap-3 text-center text-xs font-black tracking-[0.22em] text-[#ffd43b] uppercase italic sm:mb-6 sm:text-lg"
      >
        <span>★</span>
        Grand Opening Door Busters
        <span>★</span>
      </p>

      <div className="marquee-viewport marquee-mask overflow-hidden">
        <div className="marquee-track flex w-max" style={{ "--marquee-duration": MARQUEE_DURATION }}>
          <Group />
          <Group decorative />
        </div>
      </div>
    </section>
  );
}

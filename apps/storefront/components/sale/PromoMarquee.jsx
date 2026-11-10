import Image from "next/image";

// The Grand Opening "Door Buster" flyers, shown as an endlessly scrolling strip.
// The flyers carry their own prices/SKUs in the artwork, so they are plain
// images (not linked to a live product). Order is the order they are shown in.
const FLYERS = [
  {
    src: "/1000008227.png",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Lus Collection queen platform bed with footboard storage and nightstand",
  },
  {
    src: "/1000008247.png",
    width: 1536,
    height: 1024,
    alt: "Grand Opening Door Buster: Lus Collection 4-piece bedroom set",
  },
  {
    src: "/1000008225.png",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Ted Collection upholstered queen bed",
  },
  {
    src: "/1000008222.png",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Cotter Collection queen bed",
  },
  {
    src: "/1000008221.png",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Heir Collection queen platform bed, available in two colors",
  },
  {
    src: "/1000008229.png",
    width: 1199,
    height: 1312,
    alt: "Grand Opening Door Buster: Beech Collection queen bed",
  },
];

// The loop works like the homepage ticker: two identical groups side by side,
// the track slides left by exactly one group (see .marquee-* in globals.css),
// so the end of the animation is indistinguishable from its start. Each group
// holds the flyers twice, so even on a wide screen it is wider than the
// viewport and no gap ever shows. Copies other than the first set are
// aria-hidden so each flyer is announced once.
function FlyerSet({ decorative = false, repeat = false, eagerCount = 0 }) {
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
            sizes={flyer.width > flyer.height ? "(max-width: 640px) 360px, 480px" : "(max-width: 640px) 220px, 300px"}
            loading={index < eagerCount ? "eager" : "lazy"}
            className={`h-60 w-auto rounded-2xl shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] ring-2 ring-white/25 sm:h-72 lg:h-80 ${
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
      <FlyerSet decorative={decorative} eagerCount={decorative ? 0 : 4} />
      <FlyerSet decorative repeat />
    </div>
  );
}

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
        <div className="marquee-track flex w-max" style={{ "--marquee-duration": "60s" }}>
          <Group />
          <Group decorative />
        </div>
      </div>
    </section>
  );
}

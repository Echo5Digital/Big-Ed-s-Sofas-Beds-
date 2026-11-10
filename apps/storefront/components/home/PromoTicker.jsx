import { Anton } from "next/font/google";

// Loaded here rather than in the root layout so the font is only requested on
// pages that render the ticker (the homepage), not on every route.
const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap" });

// Ticker copy, as supplied in the design mock-up.
const MESSAGES = [
  { id: "sale", text: "Grand Opening Sale!" },
  { id: "doorbusters", text: "Limited Time Doorbusters!" },
  { id: "savings", text: "Big Savings on Sofas, Beds & Recliners!" },
];

// `decorative` copies exist only to fill the loop; they are hidden from
// assistive tech so each message is announced once. `repeat` marks the copies
// that reduced-motion mode drops.
function MessageSet({ decorative = false, repeat = false }) {
  return (
    <ul
      aria-hidden={decorative || undefined}
      className={`promo-ticker-set flex shrink-0 items-center ${repeat ? "promo-ticker-dup" : ""}`}
    >
      {MESSAGES.map((message) => (
        <li key={message.id} className="flex shrink-0 items-center whitespace-nowrap">
          <span>{message.text}</span>
          <span
            aria-hidden="true"
            className="promo-ticker-sep mx-[1.2em] inline-block size-[0.34em] shrink-0 rounded-full bg-[#ffd43b] shadow-[0_0_0.6em_0.12em_rgba(255,212,59,0.85)]"
          />
        </li>
      ))}
    </ul>
  );
}

// Each group is at least one viewport wide (so the loop never shows a gap on
// wide screens) and holds two copies of the messages (so it is already wide on
// normal screens without the items being spread out).
function Group({ decorative = false }) {
  return (
    <div
      aria-hidden={decorative || undefined}
      className={`promo-ticker-group flex min-w-screen shrink-0 items-center justify-around py-3 text-lg leading-none tracking-[0.04em] uppercase [text-shadow:0_2px_0_rgba(80,2,8,0.9),0_0_14px_rgba(0,0,0,0.25)] sm:text-xl md:text-2xl lg:text-[1.75rem] ${decorative ? "promo-ticker-dup" : ""}`}
    >
      <MessageSet decorative={decorative} />
      <MessageSet decorative repeat />
    </div>
  );
}

export default function PromoTicker() {
  return (
    <div
      role="group"
      aria-label="Grand opening announcements"
      className={`${anton.className} promo-ticker-shine relative isolate overflow-hidden border-y-[3px] border-[#ffcf33] bg-linear-to-b from-[#e5141f] via-[#c70d19] to-[#8f050f] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-8px_12px_-6px_rgba(0,0,0,0.5)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-linear-to-b before:from-white/15 before:to-transparent`}
    >
      <div className="promo-ticker-viewport promo-ticker-mask overflow-hidden">
        <div className="promo-ticker-track flex w-max">
          <Group />
          <Group decorative />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Anton } from "next/font/google";

// Loaded here rather than in the root layout so the font is only requested on
// pages that render the ticker (the homepage), not on every route.
const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap" });

// Ticker copy, as supplied in the design mock-up.
const MESSAGES = [
  { id: "sale", text: "Grand Opening Sale!", icon: "🔥", bothSides: true },
  { id: "doorbusters", text: "Limited Time Doorbusters!", icon: "🔥" },
  { id: "savings", text: "Big Savings on Sofas, Beds & Recliners!", icon: "✅" },
];

// One arrow click skips this fraction of a full loop, eased over NUDGE_MS. A
// loop holds six messages (three, twice over), so 0.15 is about one message.
// Done by shifting the CSS animation's clock, so it works the same whether the
// ticker is running or paused.
const NUDGE_FRACTION = 0.15;
const NUDGE_MS = 450;

const ARROW_BUTTON =
  "pointer-events-auto grid size-8 shrink-0 place-items-center rounded-lg border-2 border-[#ffcf33] bg-linear-to-b from-[#7d0510] to-[#4d0308] text-[#ffd43b] shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-125 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:size-9";

function Emoji({ symbol, delay }) {
  // Flames flicker; the check mark just pulses. Staggered so they don't move in lockstep.
  return (
    <span
      aria-hidden="true"
      className={`${symbol === "🔥" ? "promo-ticker-flame" : "promo-ticker-pop"} text-[1.15em] drop-shadow-[0_2px_2px_rgba(60,0,5,0.45)] text-shadow-none`}
      style={{ animationDelay: `-${delay}s` }}
    >
      {symbol}
    </span>
  );
}

// `decorative` copies exist only to fill the loop; they are hidden from
// assistive tech so each message is announced once. `repeat` marks the copies
// that reduced-motion mode drops.
function MessageSet({ decorative = false, repeat = false }) {
  return (
    <ul
      aria-hidden={decorative || undefined}
      className={`promo-ticker-set flex shrink-0 items-center ${repeat ? "promo-ticker-dup" : ""}`}
    >
      {MESSAGES.map((message, index) => (
        <li key={message.id} className="flex shrink-0 items-center gap-[0.4em] whitespace-nowrap">
          <Emoji symbol={message.icon} delay={index * 0.4} />
          <span>{message.text}</span>
          {message.bothSides && <Emoji symbol={message.icon} delay={index * 0.4 + 0.2} />}
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
      className={`promo-ticker-group flex min-w-screen shrink-0 items-center justify-around py-2.5 text-lg leading-none tracking-[0.04em] uppercase [text-shadow:0_2px_0_rgba(80,2,8,0.9),0_0_14px_rgba(0,0,0,0.25)] sm:text-xl md:text-2xl lg:text-[1.75rem] ${decorative ? "promo-ticker-dup" : ""}`}
    >
      <MessageSet decorative={decorative} />
      <MessageSet decorative repeat />
    </div>
  );
}

export default function PromoTicker() {
  const trackRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function nudge(direction) {
    const animation = trackRef.current
      ?.getAnimations()
      .find((candidate) => candidate.animationName === "promo-ticker-scroll");
    if (!animation || typeof animation.currentTime !== "number") return;

    const duration = animation.effect?.getComputedTiming().duration;
    if (typeof duration !== "number") return;

    // An infinite animation can't be rewound past t=0, so first step into a
    // later iteration (it looks identical) to leave room to go backwards.
    if (animation.currentTime < duration) animation.currentTime += duration;

    const distance = duration * NUDGE_FRACTION * direction;
    const startedAt = performance.now();
    let applied = 0;

    const step = (now) => {
      if (!mountedRef.current) return;
      const progress = Math.min((now - startedAt) / NUDGE_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      const target = distance * eased;
      animation.currentTime += target - applied;
      applied = target;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  return (
    <div
      role="group"
      aria-label="Grand opening announcements"
      className={`${anton.className} promo-ticker-shine relative isolate overflow-hidden border-y-[3px] border-[#ffcf33] bg-linear-to-b from-[#e5141f] via-[#c70d19] to-[#8f050f] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-8px_12px_-6px_rgba(0,0,0,0.5)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-linear-to-b before:from-white/15 before:to-transparent`}
    >
      <div className="promo-ticker-viewport promo-ticker-mask overflow-hidden">
        <div ref={trackRef} className="promo-ticker-track flex w-max">
          <Group />
          <Group decorative />
        </div>
      </div>

      <div className="promo-ticker-controls pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2 sm:px-3">
        <button type="button" onClick={() => nudge(-1)} aria-label="Scroll announcements back" className={ARROW_BUTTON}>
          <ChevronLeft className="size-5 lg:size-6" strokeWidth={3} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => nudge(1)} aria-label="Scroll announcements forward" className={ARROW_BUTTON}>
          <ChevronRight className="size-5 lg:size-6" strokeWidth={3} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

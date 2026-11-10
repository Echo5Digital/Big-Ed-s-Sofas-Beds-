import Image from "next/image";
import Container from "@/components/ui/Container";

// Decorative confetti: [position, size, colour, rotation].
const CONFETTI = [
  ["left-[14%] top-[14%]", "h-1.5 w-4", "bg-[#2f6bff]", "rotate-[-28deg]"],
  ["left-[20%] top-[8%]", "h-1.5 w-1.5", "bg-[#ffc400]", "rotate-12"],
  ["left-[26%] top-[26%]", "h-4 w-1.5", "bg-[#ff9d1c]", "rotate-[25deg]"],
  ["left-[10%] top-[40%]", "h-1.5 w-3.5", "bg-[#a855f7]", "rotate-[18deg]"],
  ["left-[88%] top-[12%]", "h-4 w-1.5", "bg-[#ff9d1c]", "rotate-[35deg]"],
  ["left-[93%] top-[22%]", "h-1.5 w-4", "bg-[#2f6bff]", "rotate-[-20deg]"],
  ["left-[82%] top-[30%]", "h-1.5 w-1.5", "bg-[#ffc400]", "rotate-12"],
  ["left-[96%] top-[44%]", "h-1.5 w-3.5", "bg-[#a855f7]", "rotate-[40deg]"],
];

// Three short red rays, like the sparkle marks beside the title in the design.
function Sparkles({ flip = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={`absolute top-0 size-9 text-brand-red sm:size-14 ${
        flip ? "-right-9 scale-x-[-1] sm:-right-16" : "-left-9 sm:-left-16"
      }`}
    >
      <g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round">
        <path d="M8 26 L22 17" />
        <path d="M5 11 L17 11" />
        <path d="M14 42 L24 29" />
      </g>
    </svg>
  );
}

export default function SaleHeader() {
  return (
    <header className="relative isolate overflow-hidden bg-linear-to-b from-[#fffdf8] via-[#fff7e6] to-[#fdecc8] pt-8 pb-10 sm:pt-12 sm:pb-14">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,206,48,0.32),transparent_65%)]"
      />

      <Container className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden sm:block">
          {CONFETTI.map(([position, size, colour, rotation]) => (
            <span key={position} className={`absolute rounded-[1px] ${position} ${size} ${colour} ${rotation}`} />
          ))}
        </div>

        <div className="relative flex flex-col items-center text-center lg:pl-64 xl:pl-76">
          <div
            aria-hidden="true"
            className="pointer-events-none relative mb-2 w-36 sm:w-44 lg:absolute lg:bottom-[-2.5rem] lg:left-0 lg:mb-0 lg:w-64 xl:w-80"
          >
            <Image
              src="/images/mascot/big-ed-thumbsup.webp"
              alt=""
              width={1584}
              height={993}
              priority
              sizes="(max-width: 1279px) 256px, 320px"
              className="h-auto w-full"
              style={{
                WebkitMaskImage: "linear-gradient(to bottom, #000 80%, transparent)",
                maskImage: "linear-gradient(to bottom, #000 80%, transparent)",
              }}
            />
          </div>

          <p className="text-xs font-extrabold tracking-[0.25em] text-brand-red uppercase italic sm:text-base">
            ★ Limited Time Only ★
          </p>

          <h1 className="relative mt-2 inline-block text-[2.4rem] leading-none font-black text-[#0b1b4d] italic sm:mt-3 sm:text-6xl xl:text-7xl">
            <Sparkles />
            Grand Opening{" "}
            <span className="relative inline-block text-brand-red">
              Sale
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-0 -z-10 h-2 w-full -rotate-1 rounded-full bg-[#ffd21f] sm:h-3"
              />
            </span>
            <Sparkles flip />
          </h1>

          <p className="mt-5 max-w-2xl text-base font-bold text-[#14246b] text-balance sm:mt-6 sm:text-xl">
            Shop all Door Buster deals &ndash; limited time only!
          </p>
        </div>
      </Container>
    </header>
  );
}

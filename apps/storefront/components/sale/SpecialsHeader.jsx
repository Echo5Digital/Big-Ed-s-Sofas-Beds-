// The blue title bar that opens each "… Specials" section of the
// /grand-opening-sale page: an icon tile, the section heading (with an
// optional count) and a yellow tagline pill.
export default function SpecialsHeader({ id, icon: Icon, title, count, tagline }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-linear-to-r from-[#0a2a80] via-[#1346c9] to-[#0a2a80] p-3 shadow-[0_14px_30px_-14px_rgba(10,42,128,0.75)] ring-1 ring-white/20 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-b from-[#ffe45c] to-[#ffb800] text-[#0b1b4d] shadow-md sm:size-14">
          <Icon className="size-6 sm:size-8" strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h2 id={id} className="text-[1.3rem] font-black text-white italic sm:text-4xl">
          {title}{" "}
          {count > 0 && <span className="text-[#ffd43b]">({count})</span>}
        </h2>
      </div>
      <p className="rounded-full bg-linear-to-b from-[#ffec6e] to-[#ffc400] px-4 py-2 text-center text-xs font-extrabold text-[#0b1b4d] italic shadow-md sm:text-base">
        {tagline}
      </p>
    </div>
  );
}

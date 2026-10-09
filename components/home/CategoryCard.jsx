import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function CategoryCard({ category }) {
  return (
    <Link
      href="#"
      aria-label={`Shop ${category.name}`}
      className="group relative block aspect-[4/3] w-[42vw] shrink-0 snap-start overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red sm:w-auto sm:shrink sm:snap-none"
    >
      <Image
        src={category.image}
        alt={category.name}
        fill
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
        <span className="text-sm font-bold text-white sm:text-base">{category.name}</span>
        <ChevronRight className="size-4 shrink-0 text-white transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { blogPosts } from "@/lib/mock-data/blog";

export const metadata = {
  title: "Blog | Big Ed's Sofas & Beds",
  description: "Furniture care tips and buying guides from Big Ed's Sofas & Beds.",
};

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  return (
    <div className="py-8 sm:py-10">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />

        <h1 className="mt-4 font-display text-3xl font-bold text-brand-charcoal sm:text-4xl">
          Furniture Care &amp; Buying Guides
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-charcoal/70 sm:text-base">
          Practical tips for choosing, measuring, and caring for furniture and mattresses.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-brand-charcoal/10 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              <div className="relative aspect-16/9 w-full overflow-hidden bg-brand-cream">
                <Image
                  src={post.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 rounded-full bg-brand-gold px-3 py-1 text-xs font-bold text-brand-charcoal">
                  {post.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h2 className="font-display text-lg font-semibold text-brand-charcoal group-hover:text-brand-red-dark">
                  {post.title}
                </h2>
                <p className="flex-1 text-sm text-brand-charcoal/70">{post.excerpt}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-brand-charcoal/50">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    {formatDate(post.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {post.readTime}
                  </span>
                </div>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-red-dark">
                  Read Article
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
}

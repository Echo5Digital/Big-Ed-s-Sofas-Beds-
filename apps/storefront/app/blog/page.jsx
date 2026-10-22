import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PageHero from "@/components/ui/PageHero";
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
    <div className="pb-10">
      <PageHero
        title="Furniture Care & Buying Guides"
        subtitle="Practical tips for choosing, measuring, and caring for furniture and mattresses."
      />

      <Container className="mt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
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

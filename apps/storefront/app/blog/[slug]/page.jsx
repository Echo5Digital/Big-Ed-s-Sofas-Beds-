import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { blogPosts } from "@/lib/mock-data/blog";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) {
    return { title: "Article Not Found | Big Ed's Sofas & Beds" };
  }
  return {
    title: `${post.title} | Big Ed's Sofas & Beds Blog`,
    description: post.excerpt,
  };
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="pb-10">
      <Container className="pt-6">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]}
        />
      </Container>

      <Container className="mt-5 max-w-3xl">
        <span className="inline-flex rounded-full bg-brand-gold px-3 py-1 text-xs font-bold text-brand-charcoal">
          {post.category}
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">
          {post.title}
        </h1>
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

        <div className="relative mt-6 aspect-16/9 w-full overflow-hidden rounded-2xl bg-brand-cream">
          <Image src={post.image} alt="" fill sizes="(max-width: 1024px) 100vw, 768px" className="object-cover" />
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {post.body.map((paragraph, index) => (
            <p key={index} className="text-sm leading-relaxed text-brand-charcoal/80 sm:text-base">
              {paragraph}
            </p>
          ))}
        </div>

        <Link
          href="/blog"
          className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-brand-red-dark hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to All Articles
        </Link>
      </Container>
    </div>
  );
}

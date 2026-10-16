import Container from "@/components/ui/Container";
import CategoryCard from "@/components/home/CategoryCard";

// Homepage "Shop by Category" teaser shows a curated subset in a fixed
// order, not the full catalog list (that's what /shop is for) — matches
// product slugs from packages/database/prisma/seed.js.
const FEATURED_SLUGS = ["sofas", "sectionals", "recliners", "bedroom", "mattresses", "dining"];

// Takes already-fetched categories (see app/page.jsx) so the homepage can
// fetch this and FeaturedProducts' data concurrently instead of waterfalling.
export default function CategoryGrid({ categories }) {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const featured = FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);

  return (
    <section aria-label="Shop by category" className="bg-brand-cream py-10 sm:py-14">
      <Container>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {featured.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </Container>
    </section>
  );
}

import { categories } from "@/lib/mock-data/categories";
import Container from "@/components/ui/Container";
import CategoryCard from "@/components/home/CategoryCard";

export default function CategoryGrid() {
  return (
    <section aria-label="Shop by category" className="bg-brand-cream py-8 sm:py-10">
      <Container>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide snap-x sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </Container>
    </section>
  );
}

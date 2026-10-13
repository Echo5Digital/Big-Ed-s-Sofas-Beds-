import { Tag } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import EmptyState from "@/components/ui/EmptyState";
import ProductCard from "@/components/home/ProductCard";
import BearMascot from "@/components/ui/BearMascot";
import { getDealsProducts } from "@/lib/shop";

export const metadata = {
  title: "Deals | Big Ed's Sofas & Beds",
  description: "Shop the best current markdowns on sofas, mattresses, bedroom sets and dining sets at Big Ed's Sofas & Beds.",
};

export default function DealsPage() {
  const deals = getDealsProducts();

  return (
    <div className="pb-10">
      <section className="bg-gradient-to-r from-brand-red-dark via-brand-red to-brand-red-dark py-10 sm:py-12">
        <Container className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <BearMascot className="h-24 w-24 shrink-0 drop-shadow-xl sm:h-28 sm:w-28" pose="thumbsup" />
          <div>
            <h1 className="font-display text-stroke-dark text-3xl font-bold leading-[1.05] text-brand-gold drop-shadow-[0_3px_0_rgba(0,0,0,0.3)] sm:text-4xl">
              UnBEARably Good Deals
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
              Real markdowns on in-stock furniture — no gimmicks, just big savings while supplies
              last.
            </p>
          </div>
        </Container>
      </section>

      <Container className="mt-8 sm:mt-10">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Deals" }]} />

        <div className="mt-6">
          {deals.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {deals.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Tag}
              title="No active deals right now"
              description="Check back soon — new markdowns are added regularly. In the meantime, browse our full catalog."
              actionLabel="Shop All Furniture"
              actionHref="/shop"
            />
          )}
        </div>
      </Container>
    </div>
  );
}

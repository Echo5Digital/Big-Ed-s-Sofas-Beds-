import HeroBanner from "@/components/home/HeroBanner";
import CategoryGrid from "@/components/home/CategoryGrid";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import DealsBanner from "@/components/home/DealsBanner";
import BenefitsSection from "@/components/home/BenefitsSection";
import ShowroomSection from "@/components/home/ShowroomSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FinancingBanner from "@/components/home/FinancingBanner";
import NewsletterSignup from "@/components/home/NewsletterSignup";

export default function HomePage() {
  return (
    <>
      <HeroBanner />
      <CategoryGrid />
      <FeaturedProducts />
      <DealsBanner />
      <BenefitsSection />
      <ShowroomSection />
      <TestimonialsSection />
      <FinancingBanner />
      <NewsletterSignup />
    </>
  );
}

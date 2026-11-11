import SaleHeader from "@/components/sale/SaleHeader";
import PromoMarquee from "@/components/sale/PromoMarquee";
import SaleProducts from "@/components/sale/SaleProducts";
import { getGrandOpeningProducts } from "@/lib/grandOpeningSale";
import { getLivingRoomProducts } from "@/lib/livingRoomSale";
import { montserrat } from "@/lib/doorbusterFont";

export const metadata = {
  title: "Grand Opening Sale | Big Ed's Sofas & Beds",
  description:
    "Big Ed's Sofas & Beds Grand Opening Door Busters — big savings on beds, bedroom sets, sofas, sectionals and recliners for a limited time. Big Comfort. Bigger Savings.",
};

// The product lists are chosen live from the catalog and cached for a few
// minutes (see lib/grandOpeningSale.js and lib/livingRoomSale.js), the same
// approach as the homepage.
export default async function GrandOpeningSalePage() {
  const [products, livingRoomProducts] = await Promise.all([getGrandOpeningProducts(), getLivingRoomProducts()]);

  return (
    <div className={montserrat.className}>
      <SaleHeader />
      <PromoMarquee />
      <SaleProducts products={products} livingRoomProducts={livingRoomProducts} />
    </div>
  );
}

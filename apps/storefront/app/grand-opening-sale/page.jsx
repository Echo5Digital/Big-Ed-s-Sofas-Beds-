import SaleHeader from "@/components/sale/SaleHeader";
import SaleProducts from "@/components/sale/SaleProducts";
import { getGrandOpeningProducts } from "@/lib/grandOpeningSale";
import { getLivingRoomProducts } from "@/lib/livingRoomSale";

export const metadata = {
  title: "Grand Opening Sale | Big Ed's Sofas & Beds",
  description:
    "Big Ed's Sofas & Beds Grand Opening Sale — big savings on beds, bedroom sets, sofas, sectionals and recliners for a limited time. Big Comfort. Bigger Savings.",
};

// The product lists are chosen live from the catalog and cached for a few
// minutes (see lib/grandOpeningSale.js and lib/livingRoomSale.js), the same
// approach as the homepage. This page uses the site's normal font tokens
// (font-sans/font-display, set globally in app/globals.css) rather than the
// one-off italic Montserrat face the carnival-flyer version of this page
// used — see lib/doorbusterFont.js, still used by the homepage's
// DoorbusterDeals section, which this page no longer shares a look with.
export default async function GrandOpeningSalePage() {
  const [products, livingRoomProducts] = await Promise.all([getGrandOpeningProducts(), getLivingRoomProducts()]);

  return (
    <div>
      <SaleHeader />
      <SaleProducts products={products} livingRoomProducts={livingRoomProducts} />
    </div>
  );
}

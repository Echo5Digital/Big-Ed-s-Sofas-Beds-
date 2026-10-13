import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Shipping & Delivery | Big Ed's Sofas & Beds",
  description: "Shipping and delivery information for Big Ed's Sofas & Beds.",
};

export default function ShippingDeliveryPage() {
  return (
    <LegalPageLayout title="Shipping & Delivery" lastUpdated="October 13, 2026">
      <p>
        We want your new furniture to arrive safely and on time. Here&rsquo;s a general overview of
        how delivery and pickup work at Big Ed&rsquo;s Sofas &amp; Beds. Specific fees and delivery
        windows require business sign-off and may vary by order &mdash; always confirm final details
        at checkout or with our showroom team.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Local Delivery</h2>
      <p>
        We offer local delivery for most furniture purchases. Delivery fees are based on distance,
        order size, and scheduling, and will be confirmed before your order is finalized. Typical
        delivery windows for in-stock items run within approximately 3&ndash;10 business days,
        though exact timing depends on the item and your location.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Showroom Pickup</h2>
      <p>
        Prefer to pick up your order yourself? Showroom pickup is available at no additional charge
        for most items. We&rsquo;ll contact you to schedule a pickup time once your order is ready.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Special Orders</h2>
      <p>
        Items that are not in our current in-stock inventory may require a longer lead time.
        Our team will give you an estimated timeframe at the time of order.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Delivery Day</h2>
      <p>
        Please make sure pathways, doorways, and stairwells are clear so our delivery team can bring
        your furniture in safely. We recommend reviewing product dimensions on each product page
        ahead of time to confirm fit.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Questions</h2>
      <p>
        For delivery questions on a specific order, please contact us via our{" "}
        <a href="/contact" className="font-semibold text-brand-red-dark hover:underline">
          Contact page
        </a>{" "}
        or call the showroom directly.
      </p>
    </LegalPageLayout>
  );
}

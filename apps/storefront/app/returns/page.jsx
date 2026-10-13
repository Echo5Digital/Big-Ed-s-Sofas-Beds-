import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Returns | Big Ed's Sofas & Beds",
  description: "Return policy information for Big Ed's Sofas & Beds.",
};

export default function ReturnsPage() {
  return (
    <LegalPageLayout title="Returns Policy" lastUpdated="October 13, 2026">
      <p>
        We want you to love your new furniture. Below is a general overview of our return
        guidelines. Final return windows, restocking fees, and exceptions require business
        sign-off and may be adjusted before this policy is finalized.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Standard Return Window</h2>
      <p>
        Most furniture purchases may be returned or exchanged within 7 days of delivery or pickup,
        provided the item is in its original, unused condition. Mattresses typically follow a
        separate comfort-exchange policy due to hygiene considerations &mdash; ask our showroom team
        for current mattress-specific terms.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Condition Requirements</h2>
      <p>
        Returned items should be free of damage, stains, and odors, and include all original
        parts, hardware, and packaging where possible. Custom or special-order items may not be
        eligible for return.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Restocking Fees</h2>
      <p>
        Some returns may be subject to a restocking fee to cover inspection and return shipping or
        delivery costs. Any applicable fee will be communicated before your return is finalized.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Damaged or Defective Items</h2>
      <p>
        If an item arrives damaged or has a manufacturing defect, please contact us as soon as
        possible so we can arrange an inspection, repair, replacement, or refund at no additional
        cost to you.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">How to Start a Return</h2>
      <p>
        To start a return or exchange, contact us via our{" "}
        <a href="/contact" className="font-semibold text-brand-red-dark hover:underline">
          Contact page
        </a>{" "}
        with your order details, and our team will walk you through next steps.
      </p>
    </LegalPageLayout>
  );
}

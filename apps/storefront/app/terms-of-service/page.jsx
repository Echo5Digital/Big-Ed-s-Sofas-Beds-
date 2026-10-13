import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Terms of Service | Big Ed's Sofas & Beds",
  description: "Terms of service for the Big Ed's Sofas & Beds website.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="October 13, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Big Ed&rsquo;s Sofas
        &amp; Beds website. By browsing this site, you agree to these Terms.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Use of This Site</h2>
      <p>
        This website is provided for browsing furniture, learning about our showroom, and (in a
        future phase) placing orders. Product names, prices, availability and ratings shown on
        this site are illustrative demo data unless otherwise noted, and are subject to change.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Orders &amp; Payment</h2>
      <p>
        At this stage, the checkout flow on this site is for demonstration purposes only. No
        payment is collected and no order is actually placed when you submit the checkout form.
        Real order processing and payment will be enabled in a future release.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Pricing &amp; Availability</h2>
      <p>
        Prices, discounts, and stock availability displayed on this site are placeholders for
        demonstration and are not a binding offer to sell at a given price. Final pricing and
        availability are confirmed in-store or by phone.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Intellectual Property</h2>
      <p>
        Content on this site, including text, graphics, and the Big Ed&rsquo;s name and logo, is
        the property of Big Ed&rsquo;s Sofas &amp; Beds or its licensors and may not be used without
        permission.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Limitation of Liability</h2>
      <p>
        This site is provided &ldquo;as is&rdquo; during its demo phase. We are not liable for any
        damages arising from use of this site while it remains in active development.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Contact</h2>
      <p>
        Questions about these Terms can be directed to us via our{" "}
        <a href="/contact" className="font-semibold text-brand-red-dark hover:underline">
          Contact page
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}

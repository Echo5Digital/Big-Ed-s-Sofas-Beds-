import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Privacy Policy | Big Ed's Sofas & Beds",
  description: "Privacy policy for the Big Ed's Sofas & Beds website.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="October 13, 2026">
      <p>
        Big Ed&rsquo;s Sofas &amp; Beds (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
        respects your privacy. This policy explains, in plain terms, what information we collect
        through this website and how we plan to use it.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Information We Collect</h2>
      <p>
        When you use forms on this site &mdash; such as the newsletter sign-up, contact form, or
        checkout demo &mdash; you may provide information like your name, email address, phone
        number, and mailing address. We may also collect basic technical information such as
        browser type and pages visited, to help us understand how the site is used.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">How We Use Information</h2>
      <p>
        Information submitted through this site is intended to be used to respond to inquiries,
        process orders, and improve our products and services. At the time of writing, several
        forms on this site are demo-only and are not yet connected to a live backend or email
        system &mdash; information submitted through those forms is not currently stored or acted
        upon.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Cookies &amp; Tracking</h2>
      <p>
        We may use cookies or similar technologies to support basic site functionality, such as
        remembering items in your cart during a session. We do not currently use third-party
        advertising trackers on this site.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Sharing of Information</h2>
      <p>
        We do not sell personal information. Information may be shared with service providers
        (such as a delivery partner or financing provider) only as needed to fulfill a request you
        make, such as processing a delivery or a financing application.
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Your Choices</h2>
      <p>
        You can ask us to access, correct, or delete personal information you&rsquo;ve provided by
        contacting us using the information on our{" "}
        <a href="/contact" className="font-semibold text-brand-red-dark hover:underline">
          Contact page
        </a>
        .
      </p>

      <h2 className="font-display text-xl font-semibold text-brand-charcoal">Changes to This Policy</h2>
      <p>
        This is a draft policy pending legal review. We will update this page as our practices and
        legal obligations are finalized.
      </p>
    </LegalPageLayout>
  );
}

import { Briefcase, Mail } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PageHero from "@/components/ui/PageHero";

export const metadata = {
  title: "Careers | Big Ed's Sofas & Beds",
  description: "Career opportunities at Big Ed's Sofas & Beds.",
};

export default function CareersPage() {
  return (
    <div className="pb-10">
      <PageHero title="Careers" showMascot={false} />

      <Container className="mt-8 max-w-2xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Careers" }]} />

        <div className="mt-6 rounded-2xl border border-brand-charcoal/10 bg-white p-6 text-center sm:p-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <Briefcase className="size-7" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">
            We&rsquo;re Growing
          </h2>
          <p className="mt-3 text-sm text-brand-charcoal/70 sm:text-base">
            Big Ed&rsquo;s Sofas &amp; Beds doesn&rsquo;t have any open positions listed right now.
            We&rsquo;re a growing local business, and that can change &mdash; so check back, or reach out
            directly if you&rsquo;d like to introduce yourself for future opportunities.
          </p>

          <a
            href="mailto:careers@bigedsfurniture.example"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            careers@bigedsfurniture.example
          </a>
        </div>
      </Container>
    </div>
  );
}

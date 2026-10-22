import Image from "next/image";
import { CreditCard, Calendar, ShieldCheck, HelpCircle } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PageHero from "@/components/ui/PageHero";
import { financingProviders } from "@/lib/mock-data/site-config";

export const metadata = {
  title: "Financing | Big Ed's Sofas & Beds",
  description: "Learn about flexible financing options available at Big Ed's Sofas & Beds.",
};

const highlights = [
  {
    icon: Calendar,
    title: "Flexible Payment Terms",
    description: "Choose a plan length that fits your budget, from short-term to extended payment schedules.",
  },
  {
    icon: CreditCard,
    title: "Multiple Providers",
    description: "We work with several financing partners so you can compare options and pick what works best.",
  },
  {
    icon: ShieldCheck,
    title: "Apply In-Store or by Phone",
    description: "Our showroom team can walk you through an application and answer questions in person.",
  },
];

const faqs = [
  {
    question: "Do I need good credit to be approved?",
    answer:
      "Each financing provider sets its own approval criteria, and options vary by credit profile. Some providers specialize in programs for a range of credit histories — our team can point you toward the provider that best fits your situation.",
  },
  {
    question: "Will financing affect my credit score?",
    answer:
      "This depends on the provider and the type of application (a pre-qualification check versus a full application). Ask about the specific impact before applying with any provider.",
  },
  {
    question: "Can I pay off my financing early?",
    answer:
      "Many financing plans allow early payoff, sometimes with interest savings. Review your provider's specific agreement for early payment terms before signing.",
  },
  {
    question: "What if I have questions about my application?",
    answer:
      "Financing applications and approvals are handled directly by each provider, not by Big Ed's. For account-specific questions, contact the provider directly using the information on your application confirmation.",
  },
];

export default function FinancingPage() {
  return (
    <div className="pb-10">
      <PageHero
        title="Comfort Today. Pay Your Way."
        subtitle="Big Ed's works with multiple financing partners to help make quality furniture fit your budget. Specific terms, rates, and approval are determined by each financing provider, not by Big Ed's — ask our showroom team which options are currently available."
      />

      <Container className="mt-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Financing" }]} />

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-brand-charcoal/10 bg-white p-5">
              <Icon className="size-7 text-brand-red" aria-hidden="true" strokeWidth={1.75} />
              <h2 className="mt-3 font-display text-base font-semibold text-brand-charcoal">{title}</h2>
              <p className="mt-1 text-sm text-brand-charcoal/70">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <h2 className="font-display text-xl font-semibold text-brand-charcoal">Our Financing Partners</h2>
          <p
            className="mt-1 text-xs text-brand-charcoal/50"
            aria-label="Financing provider logos — partnerships pending confirmation"
          >
            Displaying a provider&rsquo;s logo does not by itself confirm an active financing
            partnership — confirm current availability in-store.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {financingProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex h-14 w-32 items-center justify-center rounded-md border border-brand-charcoal/10 bg-white px-3 sm:w-36"
              >
                <Image
                  src={provider.logo}
                  alt={provider.name}
                  width={160}
                  height={60}
                  className="h-full w-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 max-w-3xl">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-6 text-brand-red" aria-hidden="true" />
            <h2 className="font-display text-xl font-semibold text-brand-charcoal">
              Financing FAQs
            </h2>
          </div>
          <div className="mt-4 flex flex-col divide-y divide-brand-charcoal/10 rounded-xl border border-brand-charcoal/10 bg-white">
            {faqs.map((faq) => (
              <details key={faq.question} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold text-brand-charcoal marker:content-none">
                  {faq.question}
                </summary>
                <p className="mt-2 text-sm text-brand-charcoal/70">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}

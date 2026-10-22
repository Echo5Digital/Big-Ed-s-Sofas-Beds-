import { AlertTriangle } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PageHero from "@/components/ui/PageHero";

export default function LegalPageLayout({ title, lastUpdated, children }) {
  return (
    <div className="pb-10">
      <PageHero title={title} subtitle={lastUpdated ? `Last updated: ${lastUpdated}` : undefined} showMascot={false} />

      <Container className="mt-8 max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm text-brand-charcoal/80">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />
          <span>Draft policy &mdash; pending legal review. This content is a reasonable starting draft and has not yet been approved by Big Ed&rsquo;s leadership or legal counsel.</span>
        </div>

        <div className="prose-legal mt-6 flex flex-col gap-5 text-sm leading-relaxed text-brand-charcoal/80 sm:text-base">
          {children}
        </div>
      </Container>
    </div>
  );
}

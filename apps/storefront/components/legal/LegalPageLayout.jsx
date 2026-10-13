import { AlertTriangle } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";

export default function LegalPageLayout({ title, lastUpdated, children }) {
  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />

        <h1 className="mt-4 font-display text-3xl font-bold text-brand-charcoal sm:text-4xl">
          {title}
        </h1>
        {lastUpdated && (
          <p className="mt-1 text-xs text-brand-charcoal/50">Last updated: {lastUpdated}</p>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm text-brand-charcoal/80">
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

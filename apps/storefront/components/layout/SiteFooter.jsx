import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Clock, Facebook, Instagram, Youtube, Mail, Tag, ArrowRight } from "lucide-react";
import { siteConfig } from "@/lib/mock-data/site-config";
import { buildFooterCategoryLinks } from "@/lib/categoryTree";
import Container from "@/components/ui/Container";

const COPYRIGHT_YEAR = 2026;

// buildFooterCategoryLinks (lib/categoryTree.js) always appends this as the
// last Quick Links entry. On phones it is pulled out of the list and shown as
// its own full-width row (see SiteFooter) so the two link columns stay the
// same length instead of leaving an empty slot beside it.
const DEALS_HREF = "/deals";

function TikTokIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.6 5.82c-1.01-.88-1.6-2.15-1.6-3.57h-3.13v13.2a2.9 2.9 0 1 1-2.07-2.78V9.5a6.03 6.03 0 1 0 5.2 5.97V9.68a7.1 7.1 0 0 0 4.1 1.3V8.02a4.3 4.3 0 0 1-2.5-1.2z" />
    </svg>
  );
}

const socialLinks = [
  { label: "Facebook", href: siteConfig.social.facebook, Icon: Facebook },
  { label: "Instagram", href: siteConfig.social.instagram, Icon: Instagram },
  { label: "YouTube", href: siteConfig.social.youtube, Icon: Youtube },
  { label: "TikTok", href: siteConfig.social.tiktok, Icon: TikTokIcon },
];

// Section heading. On phones a short gold bar under it gives each block a
// clear start; from sm up the bar is hidden so the tablet/desktop footer keeps
// its plain headings.
function FooterHeading({ children }) {
  return (
    <h3 className="mb-3 text-sm font-bold tracking-wide text-white">
      {children}
      <span aria-hidden="true" className="mt-2 block h-0.5 w-8 rounded-full bg-brand-gold sm:hidden" />
    </h3>
  );
}

// Contact-row icon. Phones get a 36px gold-tinted circle; from sm up it
// collapses back to the bare 16px icon the footer has always used (`className`
// carries each row's original sm+ vertical nudge).
function ContactIcon({ Icon, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 sm:size-4 sm:bg-transparent ${className}`}
    >
      <Icon className="size-4 text-brand-gold" />
    </span>
  );
}

function FooterColumn({ title, links, phoneHiddenHref }) {
  return (
    <div>
      <FooterHeading>{title}</FooterHeading>
      <ul className="flex flex-col gap-0 sm:gap-2">
        {links.map((link) => (
          <li key={link.label} className={link.href === phoneHiddenHref ? "max-sm:hidden" : undefined}>
            <Link
              href={link.href}
              className="inline-block min-h-9 py-1 text-sm text-white/70 hover:text-brand-gold"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter({ categories }) {
  const footerQuickLinks = buildFooterCategoryLinks(categories);
  const dealsLink = footerQuickLinks.find((link) => link.href === DEALS_HREF);

  return (
    <footer id="site-footer" className="bg-brand-charcoal text-white">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-8 py-8 sm:gap-10 sm:py-12 lg:grid-cols-5">
        <div className="col-span-2 flex flex-col items-start gap-2 text-left sm:gap-3 lg:col-span-1">
          {/* Phones: a larger logo (the 3:2 asset has ~7px of built-in side
              padding at this size, so -ml-1.5 puts the artwork flush with the
              text edge below it). */}
          <Image
            src={siteConfig.logo.src}
            alt={siteConfig.logo.alt}
            width={siteConfig.logo.width}
            height={siteConfig.logo.height}
            className="-ml-1.5 h-28 w-auto shrink-0 sm:ml-0 sm:h-16"
          />
          <p className="text-[11px] font-medium tracking-[0.16em] text-balance text-brand-gold/80 sm:text-wrap sm:text-xs sm:font-normal sm:tracking-wide sm:text-white/50">
            QUALITY FURNITURE&nbsp;&bull; COMFORT FOR LIFE
          </p>
        </div>

        <FooterColumn title="Quick Links" links={footerQuickLinks} phoneHiddenHref={DEALS_HREF} />
        <FooterColumn title="Company" links={siteConfig.footerCompanyLinks} />

        {/* Phones only (sm+ keeps "Deals" inside the Quick Links list). */}
        {dealsLink && (
          <Link
            href={dealsLink.href}
            className="col-span-2 -mt-3 flex items-center justify-between rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-3.5 text-sm font-bold text-brand-gold hover:bg-brand-gold/20 sm:hidden"
          >
            <span className="flex items-center gap-2.5">
              <Tag className="size-4 shrink-0" aria-hidden="true" />
              {dealsLink.label}
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        )}

        {/* Phones: Store Information sits in a subtle card instead of between two
            divider lines; sm+ drops the card chrome and is unchanged. */}
        <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 sm:col-span-1 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
          <FooterHeading>Store Information</FooterHeading>
          <ul className="flex flex-col gap-4 text-sm text-white/70 sm:gap-2.5">
            <li className="flex items-center gap-3 sm:items-start sm:gap-2">
              <ContactIcon Icon={MapPin} className="sm:mt-0.5" />
              <a href={siteConfig.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {siteConfig.address.line1}
                <br />
                {siteConfig.address.line2}
              </a>
            </li>
            <li className="flex items-center gap-3 sm:gap-2">
              <ContactIcon Icon={Phone} />
              <a href={siteConfig.phoneHref} className="inline-flex min-h-9 items-center">
                {siteConfig.phone}
              </a>
            </li>
            <li className="flex items-center gap-3 sm:items-start sm:gap-2">
              <ContactIcon Icon={Clock} className="sm:mt-0.5" />
              <span>
                {siteConfig.hours.map((h) => (
                  <span key={h.days} className="block">
                    {h.days}: {h.time}
                  </span>
                ))}
              </span>
            </li>
          </ul>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <FooterHeading>Follow Us</FooterHeading>
          <div className="mb-5 flex items-center gap-3 sm:gap-2">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-brand-gold hover:text-brand-charcoal focus-visible:outline-2 focus-visible:outline-brand-gold sm:size-9"
              >
                <Icon className="size-5 sm:size-4" />
              </a>
            ))}
          </div>
          {/* Phones: the email-list CTA is a solid gold button so it reads as the
              footer's one call to action; sm+ keeps the quiet translucent pill. */}
          <a
            href="#newsletter"
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3.5 text-sm font-bold text-brand-charcoal hover:bg-brand-gold-dark sm:justify-start sm:rounded-lg sm:bg-white/10 sm:px-3 sm:py-2.5 sm:text-xs sm:font-semibold sm:text-white sm:hover:bg-white/15"
          >
            <Mail className="size-4 shrink-0 text-brand-charcoal sm:text-brand-gold" aria-hidden="true" />
            <span className="text-balance sm:text-wrap">Join Our Email List for Exclusive Deals</span>
          </a>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-start justify-between gap-3 py-5 text-xs text-white/50 sm:flex-row sm:items-center">
          <p>
            &copy; {COPYRIGHT_YEAR} Big Ed&rsquo;s Sofas &amp; Beds with{" "}
            <a
              href="https://www.echo5digital.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-gold"
            >
              Echo5 Digital
            </a>
            . All rights reserved.
          </p>
          {/* Phone: a 2-column grid on the same column gap as the link grid above,
              so the legal links line up under Quick Links / Company instead of
              wrapping into a ragged centered row with an orphaned last item. */}
          <ul className="grid w-full grid-cols-2 gap-x-6 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-5 sm:gap-y-1">
            {siteConfig.footerLegalLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="inline-block py-1.5 hover:text-brand-gold sm:py-0">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}

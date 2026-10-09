import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Clock, Facebook, Instagram, Youtube, Mail } from "lucide-react";
import { siteConfig } from "@/lib/mock-data/site-config";
import Container from "@/components/ui/Container";

const COPYRIGHT_YEAR = 2026;

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

function FooterColumn({ title, links }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold tracking-wide text-white">{title}</h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="text-sm text-white/70 hover:text-brand-gold">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="bg-brand-charcoal text-white">
      <Container className="grid grid-cols-2 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
          <Image
            src={siteConfig.logo.src}
            alt={siteConfig.logo.alt}
            width={siteConfig.logo.width}
            height={siteConfig.logo.height}
            className="h-16 w-auto"
          />
          <p className="text-xs tracking-wide text-white/50">
            QUALITY FURNITURE &bull; COMFORT FOR LIFE
          </p>
        </div>

        <FooterColumn title="Quick Links" links={siteConfig.footerQuickLinks} />
        <FooterColumn title="Company" links={siteConfig.footerCompanyLinks} />

        <div>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-white">Store Information</h3>
          <ul className="flex flex-col gap-2.5 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <span>
                {siteConfig.address.line1}
                <br />
                {siteConfig.address.line2}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-brand-gold" aria-hidden="true" />
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

        <div>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-white">Follow Us</h3>
          <div className="mb-5 flex items-center gap-2">
            {socialLinks.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-brand-gold hover:text-brand-charcoal focus-visible:outline-2 focus-visible:outline-brand-gold"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
          <a
            href="#newsletter"
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/15"
          >
            <Mail className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
            Join Our Email List for Exclusive Deals
          </a>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/50 sm:flex-row">
          <p>&copy; {COPYRIGHT_YEAR} Big Ed&rsquo;s Sofas &amp; Beds. All rights reserved.</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            {siteConfig.footerLegalLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:text-brand-gold">
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

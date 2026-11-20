"use client";

import { useId, useState } from "react";
import { MapPin, Phone, Clock, Mail } from "lucide-react";
import Container from "@/components/ui/Container";
import PageHero from "@/components/ui/PageHero";
import { siteConfig } from "@/lib/mock-data/site-config";
import { api, ApiClientError } from "@/lib/api/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const messageId = useId();

  function handleChange(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim() || !form.message.trim()) {
      setStatus({ type: "error", message: "Please fill in your name and message." });
      return;
    }
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      await api.post("/messages", {
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      });
      setStatus({ type: "success", message: "Thanks for reaching out! We'll get back to you soon." });
      setForm({ name: "", email: "", message: "" });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof ApiClientError
            ? error.message
            : "Something went wrong sending your message. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHero
        title="Contact Us"
        subtitle="Have a question about a product, delivery, or financing? Send us a message or stop by the showroom — we're happy to help."
      />

      <Container className="mt-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 rounded-xl border border-brand-charcoal/10 bg-white p-5 sm:p-6">
              <div>
                <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={form.name}
                  onChange={handleChange("name")}
                  required
                  className="w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  required
                  className="w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold text-brand-charcoal">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={form.message}
                  onChange={handleChange("message")}
                  required
                  rows={5}
                  aria-describedby={status ? messageId : undefined}
                  className="w-full resize-none rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
                  placeholder="How can we help?"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>

              {status && (
                <p
                  id={messageId}
                  role="status"
                  className={`text-sm ${status.type === "error" ? "text-brand-red" : "text-green-700"}`}
                >
                  {status.message}
                </p>
              )}
            </form>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-2">
            <div className="rounded-xl border border-brand-charcoal/10 bg-white p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-brand-charcoal">Showroom Info</h2>
              <ul className="mt-4 flex flex-col gap-3 text-sm text-brand-charcoal/75">
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                  <a href={siteConfig.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-red-dark">
                    {siteConfig.address.line1}
                    <br />
                    {siteConfig.address.line2}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 shrink-0 text-brand-red" aria-hidden="true" />
                  <a href={siteConfig.phoneHref} className="hover:text-brand-red-dark">
                    {siteConfig.phone}
                  </a>
                </li>
                <li className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden="true" />
                  <span>
                    {siteConfig.hours.map((h) => (
                      <span key={h.days} className="block">
                        {h.days}: {h.time}
                      </span>
                    ))}
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0 text-brand-red" aria-hidden="true" />
                  <span>info@bigedsfurniture.example</span>
                </li>
              </ul>
            </div>

            <div className="aspect-4/3 w-full overflow-hidden rounded-xl border border-brand-charcoal/10 bg-white">
              <iframe
                title="Map to Big Ed's Sofas & Beds showroom"
                src={siteConfig.mapsEmbedUrl}
                className="size-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

"use client";

import { Suspense, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Phone, Clock, Mail, Undo2, Paperclip, X } from "lucide-react";
import Container from "@/components/ui/Container";
import PageHero from "@/components/ui/PageHero";
import { siteConfig } from "@/lib/mock-data/site-config";
import { api, ApiClientError } from "@/lib/api/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function ContactForm() {
  const searchParams = useSearchParams();
  // "Request Return" mode is entered only via the My Orders -> Return link
  // (apps/storefront/components/account/OrdersSection.jsx), never typed by a
  // customer directly — the reason is fixed/un-editable once here, matching
  // the requirement that Return isn't just another free-text message.
  const isReturnMode = searchParams.get("return") === "1";
  const orderNumber = searchParams.get("orderNumber") ?? "";

  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [orderReference, setOrderReference] = useState(orderNumber);
  const [referenceMode, setReferenceMode] = useState("text"); // "text" | "file"
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const messageId = useId();
  const fileInputRef = useRef(null);

  function handleChange(field) {
    return (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setAttachmentError(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      setAttachment(null);
      setAttachmentError("Only JPEG, PNG, WebP images or a PDF are allowed.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null);
      setAttachmentError("File is too large (8MB max).");
      event.target.value = "";
      return;
    }
    setAttachment(file);
  }

  function clearAttachment() {
    setAttachment(null);
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    if (isReturnMode && referenceMode === "text" && !orderReference.trim() && !attachment) {
      setStatus({ type: "error", message: "Enter an order reference or attach a file." });
      return;
    }
    if (isReturnMode && referenceMode === "file" && !attachment) {
      setStatus({ type: "error", message: "Attach a file, or switch back to typing a reference." });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      if (isReturnMode) {
        const formData = new FormData();
        formData.append("name", form.name.trim());
        formData.append("email", form.email.trim());
        formData.append("message", form.message.trim());
        if (referenceMode === "text" && orderReference.trim()) {
          formData.append("returnOrderReference", orderReference.trim());
        }
        if (attachment) formData.append("attachment", attachment);
        await api.upload("/messages/return", formData);
      } else {
        await api.post("/messages", {
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
        });
      }
      setStatus({ type: "success", message: "Thanks for reaching out! We'll get back to you soon." });
      setForm({ name: "", email: "", message: "" });
      if (isReturnMode) {
        setOrderReference(orderNumber);
        clearAttachment();
      }
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
        title={isReturnMode ? "Request a Return" : "Contact Us"}
        subtitle={
          isReturnMode
            ? "Tell us which order you'd like to return and we'll follow up by email."
            : "Have a question about a product, delivery, or financing? Send us a message or stop by the showroom — we're happy to help."
        }
      />

      <Container className="mt-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-4 rounded-xl border border-brand-charcoal/10 bg-white p-5 sm:p-6"
            >
              {isReturnMode ? (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-brand-charcoal">Reason</label>
                  <div className="flex w-full items-center gap-2 rounded-lg border border-brand-charcoal/20 bg-brand-charcoal/5 px-3.5 py-2.5 text-sm font-semibold text-brand-charcoal">
                    <Undo2 className="size-4 shrink-0 text-brand-red" aria-hidden="true" />
                    Return
                  </div>
                </div>
              ) : null}

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

              {isReturnMode ? (
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="contact-order-reference" className="block text-sm font-semibold text-brand-charcoal">
                      Order reference
                    </label>
                    <div className="flex gap-1 rounded-full bg-brand-charcoal/5 p-1 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setReferenceMode("text")}
                        className={`rounded-full px-3 py-1 transition-colors ${
                          referenceMode === "text" ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-charcoal/60"
                        }`}
                      >
                        Type it
                      </button>
                      <button
                        type="button"
                        onClick={() => setReferenceMode("file")}
                        className={`rounded-full px-3 py-1 transition-colors ${
                          referenceMode === "file" ? "bg-white text-brand-charcoal shadow-sm" : "text-brand-charcoal/60"
                        }`}
                      >
                        Upload file
                      </button>
                    </div>
                  </div>

                  {referenceMode === "text" ? (
                    <input
                      id="contact-order-reference"
                      type="text"
                      value={orderReference}
                      onChange={(event) => setOrderReference(event.target.value)}
                      className="w-full rounded-lg border border-brand-charcoal/20 bg-white px-3.5 py-2.5 text-sm text-brand-charcoal placeholder:text-brand-charcoal/40 focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-red"
                      placeholder="Order ID, bill no., or invoice number"
                    />
                  ) : (
                    <div>
                      <label
                        htmlFor="contact-attachment"
                        className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-brand-charcoal/25 bg-brand-cream/30 px-3.5 py-5 text-center text-sm text-brand-charcoal/70 transition-colors hover:border-brand-red/40 hover:bg-brand-red/5"
                      >
                        <Paperclip className="size-5 text-brand-charcoal/50" aria-hidden="true" />
                        {attachment ? attachment.name : "Upload a PDF or image of your receipt/invoice"}
                      </label>
                      <input
                        id="contact-attachment"
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                      {attachment ? (
                        <button
                          type="button"
                          onClick={clearAttachment}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-charcoal/60 hover:text-brand-red"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                          Remove file
                        </button>
                      ) : null}
                      {attachmentError ? <p className="mt-1.5 text-xs text-brand-red">{attachmentError}</p> : null}
                    </div>
                  )}
                </div>
              ) : null}

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
                  placeholder={isReturnMode ? "Tell us why you'd like to return this order…" : "How can we help?"}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-red-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Sending…" : isReturnMode ? "Submit Return Request" : "Send Message"}
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

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactForm />
    </Suspense>
  );
}

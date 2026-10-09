import Image from "next/image";
import { testimonials } from "@/lib/mock-data/testimonials";
import Container from "@/components/ui/Container";
import StarRating from "@/components/ui/StarRating";

export default function TestimonialsSection() {
  return (
    <section className="bg-brand-cream py-14 sm:py-16">
      <Container>
        <h2 className="font-display text-center text-2xl font-semibold text-brand-charcoal sm:text-3xl">
          What Our Customers Say
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs text-brand-charcoal/50">
          Illustrative customer feedback for demonstration purposes.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.id}
              className="flex h-full flex-col gap-3 rounded-xl border border-brand-charcoal/10 bg-white p-5 shadow-sm"
            >
              <StarRating rating={testimonial.rating} />
              <blockquote className="flex-1 text-sm text-brand-charcoal/80">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-3 pt-1">
                <span className="relative size-9 shrink-0 overflow-hidden rounded-full">
                  <Image
                    src={testimonial.avatar}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </span>
                <span className="text-sm font-semibold text-brand-charcoal">
                  {testimonial.customerName}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

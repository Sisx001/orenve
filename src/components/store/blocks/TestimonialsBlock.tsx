import { Reveal } from "@/components/store/Reveal";
import { SectionHeading } from "@/components/store/SectionHeading";

export type Testimonial = { name: string; city?: string; text: string };

/** Quote carousel built on CSS scroll-snap — no carousel dependency. */
export function TestimonialsBlock({ eyebrow, title, items }: { eyebrow?: string; title?: string; items: Testimonial[] }) {
  if (items.length === 0) return null;
  return (
    <section className="section border-y border-line bg-bone/40">
      <div className="container-page">
        {(title || eyebrow) && <SectionHeading eyebrow={eyebrow} title={title ?? ""} align="center" size="sm" />}

        <Reveal className="mt-12">
          <ul className="no-scrollbar -mx-gutter flex snap-x snap-mandatory gap-6 overflow-x-auto px-gutter pb-2">
            {items.map((q, i) => (
              <li
                key={`${q.name}-${i}`}
                className="w-[86%] shrink-0 snap-center border border-line bg-paper p-8 sm:w-[28rem] md:w-[30rem]"
              >
                <blockquote className="flex h-full flex-col">
                  <p className="display-italic flex-1 text-xl leading-relaxed">“{q.text}”</p>
                  <footer className="eyebrow mt-7">
                    {q.name}
                    {q.city ? ` · ${q.city}` : ""}
                  </footer>
                </blockquote>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

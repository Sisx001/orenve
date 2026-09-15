import { Reveal } from "@/components/store/Reveal";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { headlineLines } from "@/lib/store/richtext";
import { cn } from "@/lib/utils";

/** Full-width signup band. */
export function NewsletterBlock({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  const lines = headlineLines(title);
  return (
    <section className="section border-t border-line">
      <div className="container-page">
        <Reveal className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <p className="eyebrow mb-5">{eyebrow}</p>
            <h2 className="display text-balance text-display-md">
              {lines.map((l, i) => (
                <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-muted")}>
                  {l}
                </span>
              ))}
            </h2>
            <p className="mt-5 max-w-sm text-muted">{text}</p>
          </div>
          <NewsletterForm variant="stacked" />
        </Reveal>
      </div>
    </section>
  );
}

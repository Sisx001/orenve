import { LocaleLink } from "@/components/store/LocaleLink";
import { Reveal } from "@/components/store/Reveal";
import { headlineLines } from "@/lib/store/richtext";
import { cn } from "@/lib/utils";

/** Large typographic statement on ink. One accent word per view. */
export function ManifestoBlock({ eyebrow, title, text, link, button }: { eyebrow?: string; title: string; text?: string; link?: string; button?: string }) {
  const lines = headlineLines(title);
  return (
    <section className="grain relative overflow-hidden bg-coal text-snow">
      <div className="container-page section relative">
        <Reveal className="mx-auto max-w-4xl text-center">
          {eyebrow && <p className="eyebrow mb-7 text-snow/60">{eyebrow}</p>}
          <h2 className="display text-balance text-display-lg">
            {lines.map((l, i) => (
              <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-brass")}>
                {l}
              </span>
            ))}
          </h2>
          {text && <p className="mx-auto mt-9 max-w-xl leading-relaxed text-snow/70">{text}</p>}
          {button && link && (
            <LocaleLink href={link} className="btn-outline mt-11 border-snow/50 text-snow hover:bg-snow hover:text-coal">
              {button}
            </LocaleLink>
          )}
        </Reveal>
      </div>
    </section>
  );
}

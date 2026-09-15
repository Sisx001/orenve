import { LocaleLink } from "@/components/store/LocaleLink";
import { Reveal } from "@/components/store/Reveal";
import { headlineLines } from "@/lib/store/richtext";
import { cn } from "@/lib/utils";

/** Image + copy split. Alternates side so consecutive editorials don't repeat. */
export function EditorialBlock({
  eyebrow,
  title,
  text,
  image,
  link,
  button,
  flip = false,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  image?: string;
  link?: string;
  button?: string;
  flip?: boolean;
}) {
  const lines = headlineLines(title);
  return (
    <section className="section">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        {image && (
          <Reveal className={cn("relative", flip && "lg:order-2")} y={40}>
            <span className="block aspect-[4/5] w-full overflow-hidden bg-bone">
              <img src={image} alt="" aria-hidden loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </span>
          </Reveal>
        )}

        <Reveal className={cn("max-w-xl", flip && "lg:order-1")} delay={0.1}>
          {eyebrow && <p className="eyebrow mb-5">{eyebrow}</p>}
          <h2 className="display text-balance text-display-md">
            {lines.map((l, i) => (
              <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-muted")}>
                {l}
              </span>
            ))}
          </h2>
          {text && <p className="mt-7 leading-relaxed text-muted">{text}</p>}
          {button && link && (
            <LocaleLink href={link} className="btn-outline mt-9">
              {button}
            </LocaleLink>
          )}
        </Reveal>
      </div>
    </section>
  );
}

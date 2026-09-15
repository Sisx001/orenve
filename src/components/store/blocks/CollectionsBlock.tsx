import { LocaleLink } from "@/components/store/LocaleLink";
import { Reveal } from "@/components/store/Reveal";
import { SectionHeading } from "@/components/store/SectionHeading";

export type CollectionSummary = { slug: string; name: string; description: string; image: string | null; count: number };

/** Collection grid with a hover reveal of the chapter description. */
export function CollectionsBlock({
  title,
  eyebrow,
  collections,
  viewAllLabel,
  piecesLabel,
}: {
  title: string;
  eyebrow?: string;
  collections: CollectionSummary[];
  viewAllLabel: string;
  piecesLabel: (count: number) => string;
}) {
  if (collections.length === 0) return null;
  return (
    <section className="section border-t border-line">
      <div className="container-page">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          action={
            <LocaleLink href="/collections" className="btn-ghost text-oxide">
              {viewAllLabel}
            </LocaleLink>
          }
        />

        <div className="mt-14 grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          {collections.map((c, i) => (
            <Reveal key={c.slug} delay={Math.min(i * 0.08, 0.4)} className="bg-paper">
              <LocaleLink href={`/collections/${c.slug}`} data-media className="group relative block h-full overflow-hidden">
                <span className="block aspect-[3/4] w-full overflow-hidden bg-bone">
                  {c.image ? (
                    <img
                      src={c.image}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-[1200ms] ease-editorial group-hover:scale-[1.05]"
                    />
                  ) : (
                    <span className="skeleton block h-full w-full" />
                  )}
                </span>
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-coal/80 via-coal/10 to-transparent opacity-80 transition-opacity duration-700 group-hover:opacity-95" />
                <span className="absolute inset-x-0 bottom-0 block p-6 text-snow">
                  <span className="display block text-xl">{c.name}</span>
                  <span className="eyebrow mt-1.5 block text-snow/60">{piecesLabel(c.count)}</span>
                  {c.description && (
                    <span className="mt-3 block max-h-0 overflow-hidden text-sm leading-relaxed text-snow/80 opacity-0 transition-all duration-700 ease-editorial group-hover:max-h-28 group-hover:opacity-100">
                      {c.description}
                    </span>
                  )}
                </span>
              </LocaleLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

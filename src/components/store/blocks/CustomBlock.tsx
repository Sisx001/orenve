import { Reveal } from "@/components/store/Reveal";
import { RichText, headlineLines } from "@/lib/store/richtext";
import { cn } from "@/lib/utils";

/** Owner-authored free block: heading + markdown-lite body. */
export function CustomBlock({ title, body }: { title?: string; body?: string }) {
  if (!title && !body) return null;
  const lines = title ? headlineLines(title) : [];
  return (
    <section className="section">
      <div className="container-page">
        <Reveal className="mx-auto max-w-3xl">
          {lines.length > 0 && (
            <h2 className="display text-balance text-display-md">
              {lines.map((l, i) => (
                <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-muted")}>
                  {l}
                </span>
              ))}
            </h2>
          )}
          {body && <RichText body={body} className="prose-editorial mt-8 text-muted" />}
        </Reveal>
      </div>
    </section>
  );
}

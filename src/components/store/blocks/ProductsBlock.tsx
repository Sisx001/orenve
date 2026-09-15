import type { ProductCard } from "@/types";
import { LocaleLink } from "@/components/store/LocaleLink";
import { ProductGrid } from "@/components/store/ProductGrid";
import { SectionHeading } from "@/components/store/SectionHeading";

/** Featured / new-arrivals product band. */
export function ProductsBlock({
  eyebrow,
  title,
  subtitle,
  products,
  href = "/shop",
  viewAllLabel,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  products: ProductCard[];
  href?: string;
  viewAllLabel: string;
}) {
  if (products.length === 0) return null;
  return (
    <section className="section">
      <div className="container-page">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          action={
            <LocaleLink href={href} className="btn-ghost text-oxide">
              {viewAllLabel}
            </LocaleLink>
          }
        />
        <ProductGrid products={products} className="mt-14" priorityCount={0} />
      </div>
    </section>
  );
}

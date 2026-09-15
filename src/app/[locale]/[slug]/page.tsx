import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/catalog";
import { getPublicConfig } from "@/lib/settings";
import { RichText, headlineLines } from "@/lib/store/richtext";
import { Reveal } from "@/components/store/Reveal";
import { cn } from "@/lib/utils";

/** Reserved storefront routes that must never be treated as CMS slugs. */
const RESERVED = new Set(["shop", "collections", "product", "checkout", "order", "track", "contact", "wishlist", "lookbook", "search", "api", "admin"]);

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (RESERVED.has(slug)) return { title: "404" };
  const [page, config] = await Promise.all([getPage(slug, locale), getPublicConfig()]);
  if (!page) return { title: "404" };
  return {
    title: page.seoTitle,
    description: page.seoDescription,
    alternates: { canonical: `/${locale}/${slug}`, languages: { en: `/en/${slug}`, bn: `/bn/${slug}` } },
    openGraph: { title: page.seoTitle, description: page.seoDescription, images: [config.seo.ogImage || "/brand/og.jpg"] },
  };
}

export default async function CmsPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (RESERVED.has(slug)) notFound();

  const page = await getPage(slug, locale);
  if (!page) notFound();

  const lines = headlineLines(page.title);
  const editorial = page.template === "editorial";
  const legal = page.template === "legal";

  return (
    <article className={cn("container-page", editorial ? "py-16 md:py-24" : "py-14 md:py-20")}>
      <div className={cn(editorial ? "mx-auto max-w-4xl text-center" : "mx-auto max-w-2xl")}>
        <h1 className={cn("display text-balance", editorial ? "text-display-lg" : "text-display-md")}>
          {lines.map((l, i) => (
            <span key={i} className={cn("block", i % 2 === 1 && "display-italic text-muted")}>
              {l}
            </span>
          ))}
        </h1>
        {legal && <p className="eyebrow mt-6">{page.slug}</p>}
      </div>

      <Reveal className={cn("mx-auto mt-12", editorial ? "max-w-2xl" : "max-w-2xl")}>
        <RichText body={page.body} className={cn("prose-editorial text-muted", editorial && "text-[1.05rem] leading-relaxed", legal && "text-sm")} />
      </Reveal>
    </article>
  );
}

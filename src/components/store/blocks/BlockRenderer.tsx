import { listCollections, listProducts } from "@/lib/catalog";
import { getTranslator } from "@/lib/i18n/server";
import { i18nText } from "@/lib/json";
import { Marquee } from "@/components/store/Marquee";
import { Hero } from "@/components/store/blocks/Hero";
import { EditorialBlock } from "@/components/store/blocks/EditorialBlock";
import { ManifestoBlock } from "@/components/store/blocks/ManifestoBlock";
import { CollectionsBlock } from "@/components/store/blocks/CollectionsBlock";
import { LookbookBlock, type LookbookFrame } from "@/components/store/blocks/LookbookBlock";
import { TestimonialsBlock, type Testimonial } from "@/components/store/blocks/TestimonialsBlock";
import { VideoBlock } from "@/components/store/blocks/VideoBlock";
import { NewsletterBlock } from "@/components/store/blocks/NewsletterBlock";
import { ProductsBlock } from "@/components/store/blocks/ProductsBlock";
import { CustomBlock } from "@/components/store/blocks/CustomBlock";

export type HomeBlock = { id: string; type: string; data: Record<string, unknown> };

/* ── tiny readers so untyped owner JSON never leaks `any` ── */
function tx(value: unknown, locale: string): string {
  if (value == null) return "";
  if (typeof value === "string") return i18nText(value, locale);
  if (typeof value === "object") return i18nText(value as Record<string, string>, locale);
  return String(value);
}
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Maps a saved homepage block to its component, fetching whatever it needs. */
export async function BlockRenderer({ blocks, locale }: { blocks: HomeBlock[]; locale: string }) {
  const t = await getTranslator(locale);
  let editorialCount = 0;

  const rendered = await Promise.all(
    blocks.map(async (block) => {
      const d = block.data;

      switch (block.type) {
        case "hero":
          return (
            <Hero
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("home.heroEyebrow")}
              title={tx(d.title, locale) || t("home.heroTitle")}
              subtitle={tx(d.subtitle, locale) || t("home.heroSubtitle")}
              cta={tx(d.cta, locale) || t("home.heroCta")}
              ctaLink={str(d.ctaLink) || "/shop"}
              secondary={tx(d.secondary, locale) || t("home.heroSecondary")}
              secondaryLink={str(d.secondaryLink) || "/about"}
              caption={tx(d.caption, locale) || t("home.heroCaption")}
              images={list(d.images).filter((x): x is string => typeof x === "string")}
              video={str(d.video)}
              poster={str(d.poster)}
              focal={str(d.focal) || "50% 35%"}
              overlay={num(d.overlay, 0.25)}
            />
          );

        case "marquee":
          return <Marquee key={block.id} text={tx(d.text, locale) || t("home.marquee")} />;

        case "featured": {
          const all = await listProducts(locale, { sort: "featured" });
          const featured = all.filter((p) => p.featured);
          const products = (featured.length > 0 ? featured : all).slice(0, Math.max(1, num(d.limit, 4)));
          return (
            <ProductsBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("home.selectedPieces")}
              title={tx(d.title, locale) || t("home.selectedPieces")}
              subtitle={tx(d.subtitle, locale) || t("home.selectedSubtitle")}
              products={products}
              viewAllLabel={t("common.viewAll")}
            />
          );
        }

        case "arrivals": {
          const products = (await listProducts(locale, { sort: "newest" })).slice(0, Math.max(1, num(d.limit, 4)));
          return (
            <ProductsBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("nav.newArrivals")}
              title={tx(d.title, locale) || t("home.arrivalsTitle")}
              subtitle={tx(d.subtitle, locale) || t("home.arrivalsSubtitle")}
              products={products}
              href="/shop?sort=newest"
              viewAllLabel={t("common.viewAll")}
            />
          );
        }

        case "editorial": {
          const flip = editorialCount++ % 2 === 1;
          return (
            <EditorialBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("home.philosophyEyebrow")}
              title={tx(d.title, locale) || t("home.philosophyTitle")}
              text={tx(d.text, locale) || t("home.philosophyText")}
              image={str(d.image)}
              link={str(d.link) || "/about"}
              button={tx(d.button, locale) || t("home.philosophyCta")}
              flip={flip}
            />
          );
        }

        case "collections": {
          const collections = await listCollections(locale);
          return (
            <CollectionsBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("nav.collections")}
              title={tx(d.title, locale) || t("home.collectionsTitle")}
              collections={collections.slice(0, 4)}
              viewAllLabel={t("common.viewAll")}
              piecesLabel={(count) => t("shop.results", { count })}
            />
          );
        }

        case "lookbook": {
          const frames: LookbookFrame[] = list(d.frames)
            .map((f) => (f && typeof f === "object" ? (f as Record<string, unknown>) : null))
            .filter((f): f is Record<string, unknown> => f !== null && typeof f.image === "string")
            .map((f) => ({
              image: str(f.image),
              productSlug: str(f.productSlug) || undefined,
              x: typeof f.x === "number" ? f.x : undefined,
              y: typeof f.y === "number" ? f.y : undefined,
              caption: tx(f.caption, locale) || undefined,
            }));
          return (
            <LookbookBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("home.campaignEyebrow")}
              title={tx(d.title, locale) || t("home.lookbookTitle")}
              frames={frames}
            />
          );
        }

        case "testimonials": {
          const items: Testimonial[] = list(d.items)
            .map((i) => (i && typeof i === "object" ? (i as Record<string, unknown>) : null))
            .filter((i): i is Record<string, unknown> => i !== null)
            .map((i) => ({ name: str(i.name), city: str(i.city) || undefined, text: tx(i.text, locale) }))
            .filter((i) => i.text !== "");
          return (
            <TestimonialsBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("home.testimonialsEyebrow")}
              title={tx(d.title, locale)}
              items={items}
            />
          );
        }

        case "manifesto":
          return (
            <ManifestoBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("home.manifestoEyebrow")}
              title={tx(d.title, locale) || t("home.manifestoTitle")}
              text={tx(d.text, locale) || t("home.manifestoText")}
              link={str(d.link) || "/about"}
              button={tx(d.button, locale) || t("home.manifestoCta")}
            />
          );

        case "video":
          return <VideoBlock key={block.id} url={str(d.url)} poster={str(d.poster)} eyebrow={tx(d.eyebrow, locale) || t("home.videoEyebrow")} title={tx(d.title, locale)} />;

        case "newsletter":
          return (
            <NewsletterBlock
              key={block.id}
              eyebrow={tx(d.eyebrow, locale) || t("newsletter.eyebrow")}
              title={tx(d.title, locale) || t("newsletter.title")}
              text={tx(d.text, locale) || t("newsletter.text")}
            />
          );

        case "custom":
          return <CustomBlock key={block.id} title={tx(d.title, locale)} body={tx(d.body, locale)} />;

        default:
          return null;
      }
    }),
  );

  return <>{rendered}</>;
}

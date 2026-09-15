import { getBlocks } from "@/lib/catalog";
import { BlockRenderer, type HomeBlock } from "@/components/store/blocks/BlockRenderer";

export const revalidate = 0;

/** Homepage — entirely composed from studio-managed blocks. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const blocks = (await getBlocks("home")) as HomeBlock[];

  if (blocks.length === 0) {
    // Nothing configured yet: fall back to a single hero so the site is never blank.
    return <BlockRenderer blocks={[{ id: "fallback-hero", type: "hero", data: { images: [] } }]} locale={locale} />;
  }

  return <BlockRenderer blocks={blocks} locale={locale} />;
}

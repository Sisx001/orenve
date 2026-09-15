import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { HomepageBuilder, type BlockRow } from "./HomepageBuilder";

export const dynamic = "force-dynamic";

export default async function HomepagePage() {
  await requireStudio("content.write", "/admin/homepage");
  const [blocks, csrf] = await Promise.all([db.block.findMany({ where: { page: "home" }, orderBy: { position: "asc" } }), csrfToken()]);

  const rows: BlockRow[] = blocks.map((b) => ({
    id: b.id,
    type: b.type,
    isEnabled: b.isEnabled,
    position: b.position,
    data: parseJson<Record<string, unknown>>(b.data, {}),
  }));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Homepage"
        description="Compose the front page from blocks. Changes are live as soon as you save."
        actions={
          <a href="/en" target="_blank" rel="noreferrer" className="btn-outline px-4 py-2.5 text-[0.65rem]">
            <ExternalLink className="h-3.5 w-3.5" />
            Preview
          </a>
        }
      />
      <HomepageBuilder rows={rows} csrf={csrf} page="home" />
    </div>
  );
}

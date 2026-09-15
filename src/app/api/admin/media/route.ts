import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { handleError, jsonOk } from "@/lib/api-server";
import type { MediaRow } from "@/lib/admin/types";

/** Media library listing for the picker and the library grid. */
export async function GET(req: NextRequest) {
  try {
    await requireUser("media.write");
    const sp = req.nextUrl.searchParams;
    const folder = (sp.get("folder") ?? "").trim();
    const q = (sp.get("q") ?? "").trim();
    const take = Math.min(120, Math.max(1, Number(sp.get("take") ?? "60") || 60));
    const skip = Math.max(0, Number(sp.get("skip") ?? "0") || 0);

    const where: Prisma.MediaWhereInput = {};
    if (folder) where.folder = folder;
    if (q) where.OR = [{ name: { contains: q } }, { alt: { contains: q } }, { key: { contains: q } }];

    const [rows, total, folderRows] = await Promise.all([
      db.media.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
      db.media.count({ where }),
      db.media.findMany({ distinct: ["folder"], select: { folder: true }, orderBy: { folder: "asc" } }),
    ]);

    const items: MediaRow[] = rows.map((m) => ({
      id: m.id,
      url: m.url,
      name: m.name,
      alt: m.alt,
      mime: m.mime,
      size: m.size,
      width: m.width,
      height: m.height,
      folder: m.folder,
      createdAt: m.createdAt.toISOString(),
    }));

    return jsonOk({ items, total, folders: folderRows.map((f) => f.folder) });
  } catch (e) {
    return handleError(e);
  }
}

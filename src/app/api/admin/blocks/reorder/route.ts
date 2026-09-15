import type { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

const schema = z.object({
  page: z.string().max(40).default("home"),
  ids: z.array(z.string().min(1)).max(60),
});

/** Persist a drag-and-drop reorder of homepage blocks. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("content.write");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);
    const { page, ids } = schema.parse(await req.json());

    const existing = await db.block.findMany({ where: { page }, select: { id: true } });
    const valid = new Set(existing.map((b) => b.id));
    if (ids.length !== valid.size || ids.some((id) => !valid.has(id))) {
      return jsonError("The block list is out of date — reload the page.", 409);
    }

    for (let i = 0; i < ids.length; i++) {
      await db.block.update({ where: { id: ids[i] }, data: { position: i } });
    }

    await audit(user.id, "block.reorder", "block", null, { page, count: ids.length });
    revalidatePath("/admin/homepage");
    revalidatePath("/", "layout");
    return jsonOk({ ordered: ids.length });
  } catch (e) {
    return handleError(e);
  }
}

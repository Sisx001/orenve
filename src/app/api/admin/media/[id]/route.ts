import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { getStorage } from "@/lib/media/storage";
import { mediaEditSchema } from "@/lib/admin/schemas";
import { revalidatePath } from "next/cache";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("media.write");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);
    const { id } = await params;
    const body = await req.json();
    const input = mediaEditSchema.parse({ ...body, id });

    const media = await db.media.update({
      where: { id: input.id },
      data: { name: input.name, alt: input.alt || null, folder: input.folder },
    });
    await audit(user.id, "media.update", "media", media.id, { name: media.name, folder: media.folder });
    revalidatePath("/admin/media");
    return jsonOk({ media: { id: media.id, name: media.name, alt: media.alt, folder: media.folder } });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("media.write");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);
    const { id } = await params;

    const media = await db.media.findUnique({ where: { id } });
    if (!media) return jsonError("That file no longer exists.", 404);

    const inUse = await db.productImage.count({ where: { url: media.url } });
    await getStorage().remove(media.key);
    await db.media.delete({ where: { id } });
    await audit(user.id, "media.delete", "media", id, { name: media.name, key: media.key, inUse });
    revalidatePath("/admin/media");
    revalidatePath("/", "layout");
    return jsonOk({ deleted: true, inUse });
  } catch (e) {
    return handleError(e);
  }
}

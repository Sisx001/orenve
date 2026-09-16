import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { saveContentTranslation } from "@/lib/i18n/translate";

export const runtime = "nodejs";

const schema = z
  .object({
    /** Translation row (interface string) */
    id: z.string().min(1).max(60).optional(),
    /** ContentTranslation row (catalogue / page / settings field) */
    contentId: z.string().min(1).max(60).optional(),
    action: z.enum(["approve", "edit"]),
    value: z.string().max(8000).optional(),
  })
  .refine((v) => Boolean(v.id) !== Boolean(v.contentId), { message: "Pass either id or contentId." });

/**
 * POST /api/admin/i18n/review — approve or correct one machine translation.
 * Approving keeps `machine: true` (it is still a machine translation, just a
 * reviewed one); an edit is treated as human work and becomes authoritative.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser("i18n.write");
    if (!(await verifyCsrf())) return jsonError("errors.csrf", 403);

    const body = schema.parse(await req.json());

    if (body.id) {
      const row = await db.translation.findUnique({ where: { id: body.id } });
      if (!row) return jsonError("That string is no longer in the queue.", 404);

      if (body.action === "approve") {
        await db.translation.update({ where: { id: row.id }, data: { approved: true } });
      } else {
        const value = (body.value ?? "").trim();
        if (!value) return jsonError("Enter the translation before saving.", 400);
        // A human wrote this, so it is no longer a machine string.
        await db.translation.update({ where: { id: row.id }, data: { value, machine: false, approved: true } });
      }

      await audit(user.id, `i18n.review_${body.action}`, "translation", row.id, { locale: row.locale, key: row.key });
      revalidatePath("/", "layout");
      revalidatePath(`/admin/settings/languages/${row.locale}`);
      return jsonOk({ id: row.id, approved: true });
    }

    const row = await db.contentTranslation.findUnique({ where: { id: body.contentId! } });
    if (!row) return jsonError("That field is no longer in the queue.", 404);

    if (body.action === "edit") {
      const value = (body.value ?? "").trim();
      if (!value) return jsonError("Enter the translation before saving.", 400);
      const saved = await saveContentTranslation(row.id, value);
      if (!saved) return jsonError("That field no longer exists on the record.", 409);
    }
    await db.contentTranslation.update({ where: { id: row.id }, data: { approved: true } });

    await audit(user.id, `i18n.review_${body.action}`, "contentTranslation", row.id, {
      locale: row.locale,
      model: row.model,
      field: row.field,
    });
    revalidatePath("/", "layout");
    revalidatePath(`/admin/settings/languages/${row.locale}`);
    return jsonOk({ id: row.id, approved: true });
  } catch (e) {
    return handleError(e);
  }
}

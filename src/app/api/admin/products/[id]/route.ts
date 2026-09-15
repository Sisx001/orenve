import type { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { PRODUCT_STATUSES } from "@/lib/constants";

const patchSchema = z.object({
  featured: z.boolean().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

/** Inline list toggles (featured / status) without a full page post. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("products.write");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);
    const { id } = await params;
    const input = patchSchema.parse(await req.json());
    if (input.featured === undefined && input.status === undefined) return jsonError("Nothing to change.", 400);

    const product = await db.product.update({
      where: { id },
      data: {
        ...(input.featured === undefined ? {} : { featured: input.featured }),
        ...(input.status === undefined ? {} : { status: input.status, publishedAt: input.status === "published" ? new Date() : undefined }),
      },
      select: { id: true, featured: true, status: true, slug: true },
    });

    await audit(user.id, "product.patch", "product", product.id, { ...input, slug: product.slug });
    revalidatePath("/admin/products");
    revalidatePath("/", "layout");
    return jsonOk({ product });
  } catch (e) {
    return handleError(e);
  }
}

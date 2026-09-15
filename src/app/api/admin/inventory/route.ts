import type { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";

const patchSchema = z.object({
  variantId: z.string().min(1),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  lowStockAt: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

/** Inline inventory edits from the flat variant table. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser("products.write");
    if (!(await verifyCsrf())) return jsonError("Invalid or missing CSRF token.", 403);
    const input = patchSchema.parse(await req.json());
    if (input.stock === undefined && input.lowStockAt === undefined && input.isActive === undefined) {
      return jsonError("Nothing to change.", 400);
    }

    const before = await db.productVariant.findUnique({ where: { id: input.variantId }, select: { stock: true, productId: true, title: true } });
    if (!before) return jsonError("That variant no longer exists.", 404);

    const variant = await db.productVariant.update({
      where: { id: input.variantId },
      data: {
        ...(input.stock === undefined ? {} : { stock: input.stock }),
        ...(input.lowStockAt === undefined ? {} : { lowStockAt: input.lowStockAt }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      select: { id: true, stock: true, lowStockAt: true, isActive: true },
    });

    await audit(user.id, "inventory.update", "variant", variant.id, {
      title: before.title,
      from: before.stock,
      to: variant.stock,
      productId: before.productId,
    });
    revalidatePath("/admin/inventory");
    revalidatePath("/", "layout");
    return jsonOk({ variant });
  } catch (e) {
    return handleError(e);
  }
}

import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { syncShipment } from "@/lib/couriers";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

/** POST /api/admin/shipments/{id}/sync — pull the latest courier status now. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("orders.write");
    if (!(await verifyCsrf())) return jsonError("errors.csrf", 403);
    const { id } = await ctx.params;
    const s = await syncShipment(id);
    revalidatePath(`/admin/orders/${s.orderId}`);
    return jsonOk({ shipment: s });
  } catch (e: any) {
    if (/^(Pathao|Steadfast|RedX|Paperfly)/.test(e?.message ?? "")) return jsonError(e.message, 502);
    return handleError(e);
  }
}

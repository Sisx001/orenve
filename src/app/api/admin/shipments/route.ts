import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { audit } from "@/lib/audit";
import { bookShipment, availableCouriers } from "@/lib/couriers";
import { COURIER_PROVIDERS } from "@/lib/constants";
import { handleError, jsonError, jsonOk } from "@/lib/api-server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(COURIER_PROVIDERS),
  note: z.string().max(300).optional(),
  weightKg: z.number().min(0.1).max(30).optional(),
  providerLocation: z.record(z.union([z.string(), z.number()])).optional(),
  manual: z.object({ courierName: z.string().max(60).optional(), trackingCode: z.string().max(80).optional(), trackingUrl: z.string().url().optional().or(z.literal("")) }).optional(),
});

/** GET → couriers usable right now. POST → book a consignment for an order. */
export async function GET() {
  try {
    await requireUser("orders.write");
    return jsonOk({ couriers: await availableCouriers() });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser("orders.write");
    if (!(await verifyCsrf())) return jsonError("errors.csrf", 403);
    const input = schema.parse(await req.json());
    const shipment = await bookShipment(input.orderId, input.provider, user.id, { note: input.note, weightKg: input.weightKg, providerLocation: input.providerLocation, manual: input.manual ? { ...input.manual, trackingUrl: input.manual.trackingUrl || undefined } : undefined });
    await audit(user.id, "shipment.booked", "order", input.orderId, { provider: input.provider, consignmentId: shipment.consignmentId });
    revalidatePath(`/admin/orders/${input.orderId}`);
    return jsonOk({ shipment });
  } catch (e: any) {
    if (e?.message?.startsWith("Pathao") || e?.message?.startsWith("Steadfast") || e?.message?.startsWith("RedX") || e?.message?.startsWith("Paperfly")) return jsonError(e.message, 502);
    return handleError(e);
  }
}

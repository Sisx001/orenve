"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";

const RESOLVED_TITLE = toJson({ en: "Your request was handled", bn: "আপনার অনুরোধ প্রক্রিয়া করা হয়েছে" });
const REJECTED_TITLE = toJson({ en: "Request update", bn: "অনুরোধের আপডেট" });

export async function resolveConciergeRequestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const id = String(fd.get("requestId") ?? "").trim();
    if (!id) return fail("Request ID is required.");

    const req = await db.conciergeRequest.findUnique({ where: { id }, select: { id: true, orderId: true, orderNumber: true, status: true } });
    if (!req) return fail("That request no longer exists.");
    if (req.status !== "open") return fail("This request is already closed.");

    await db.$transaction([
      db.conciergeRequest.update({
        where: { id },
        data: { status: "resolved", resolvedAt: new Date(), resolvedById: user.id },
      }),
      db.orderEvent.create({
        data: {
          orderId: req.orderId,
          type: "message",
          title: RESOLVED_TITLE,
          message: toJson({
            en: "Your concierge request has been reviewed and handled by our team.",
            bn: "আমাদের দল আপনার কনসিয়ার্জ অনুরোধটি পর্যালোচনা করেছে এবং প্রক্রিয়া করেছে।",
          }),
          isPublic: true,
        },
      }),
    ]);

    await audit(user.id, "concierge.request.resolve", "conciergeRequest", id, { orderNumber: req.orderNumber });
    revalidateStudio("/admin/concierge/requests", `/admin/orders/${req.orderId}`);
    return succeed("Request resolved.");
  });
}

export async function rejectConciergeRequestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const id = String(fd.get("requestId") ?? "").trim();
    if (!id) return fail("Request ID is required.");

    const req = await db.conciergeRequest.findUnique({ where: { id }, select: { id: true, orderId: true, orderNumber: true, status: true } });
    if (!req) return fail("That request no longer exists.");
    if (req.status !== "open") return fail("This request is already closed.");

    await db.$transaction([
      db.conciergeRequest.update({
        where: { id },
        data: { status: "rejected", resolvedAt: new Date(), resolvedById: user.id },
      }),
      db.orderEvent.create({
        data: {
          orderId: req.orderId,
          type: "message",
          title: REJECTED_TITLE,
          message: toJson({
            en: "We were unable to process your recent request. Please contact us if you have questions.",
            bn: "আমরা আপনার সাম্প্রতিক অনুরোধটি প্রক্রিয়া করতে পারিনি। প্রশ্ন থাকলে আমাদের সাথে যোগাযোগ করুন।",
          }),
          isPublic: true,
        },
      }),
    ]);

    await audit(user.id, "concierge.request.reject", "conciergeRequest", id, { orderNumber: req.orderNumber });
    revalidateStudio("/admin/concierge/requests", `/admin/orders/${req.orderId}`);
    return succeed("Request rejected.");
  });
}

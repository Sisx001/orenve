"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/request";
import { normalizeBdPhone, transitionOrder } from "@/lib/orders/service";
import { formatOrderNumber, generateTrackingCode } from "@/lib/orders/numbers";
import type { OrderStatus } from "@/lib/constants";
import { ORDER_STATUSES } from "@/lib/constants";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { courierTrackingUrl } from "@/lib/admin/constants";
import { resolveZoneRate } from "@/lib/admin/queries";
import {
  manualOrderSchema,
  orderCourierSchema,
  orderCustomerSchema,
  orderEventSchema,
  orderItemsSchema,
  paymentVerifySchema,
  readBool,
  readI18n,
  readInt,
  readJson,
} from "@/lib/admin/schemas";

function revalidateOrder(id?: string) {
  revalidateStudio("/admin/orders", "/admin", ...(id ? [`/admin/orders/${id}`] : []));
}

/* ───────────────────────────── status ───────────────────────────── */

export async function setOrderStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const orderId = String(fd.get("orderId") ?? "");
    const status = String(fd.get("status") ?? "") as OrderStatus;
    const message = String(fd.get("message") ?? "").trim();
    if (!orderId || !(ORDER_STATUSES as readonly string[]).includes(status)) return fail("Pick a valid status.");

    const before = await db.order.findUnique({ where: { id: orderId }, select: { status: true, number: true } });
    if (!before) return fail("That order no longer exists.");
    if (before.status === status) return fail(`This order is already ${status}.`);

    await transitionOrder(orderId, status, user.id, message || undefined);
    await audit(user.id, "order.status", "order", orderId, { from: before.status, to: status, number: before.number });
    revalidateOrder(orderId);
    return succeed(`Order moved to ${status}.`);
  });
}

export async function bulkOrderStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const status = String(fd.get("status") ?? "") as OrderStatus;
    const ids = fd.getAll("ids").map(String).filter(Boolean);
    if (!(ORDER_STATUSES as readonly string[]).includes(status)) return fail("Pick a status to apply.");
    if (ids.length === 0) return fail("Select at least one order.");

    let changed = 0;
    for (const id of ids.slice(0, 200)) {
      const row = await db.order.findUnique({ where: { id }, select: { status: true } });
      if (!row || row.status === status) continue;
      await transitionOrder(id, status, user.id);
      changed++;
    }
    await audit(user.id, "order.bulk_status", "order", null, { status, count: changed });
    revalidateOrder();
    return succeed(`${changed} order${changed === 1 ? "" : "s"} updated.`);
  });
}

export async function cancelOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const orderId = String(fd.get("orderId") ?? "");
    const reason = String(fd.get("reason") ?? "").trim();
    if (!orderId) return fail("Missing order.");
    if (!reason) return fail("Give a reason — it is added to the customer timeline.");
    await transitionOrder(orderId, "cancelled", user.id, reason);
    await audit(user.id, "order.cancel", "order", orderId, { reason });
    revalidateOrder(orderId);
    return succeed("Order cancelled and stock returned.");
  });
}

/* ───────────────────────────── customer & address ───────────────────────────── */

export async function updateOrderCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const input = orderCustomerSchema.parse({
      orderId: fd.get("orderId"),
      customerName: fd.get("customerName"),
      phone: fd.get("phone"),
      email: fd.get("email") ?? "",
      notes: fd.get("notes") ?? "",
      address: {
        line1: fd.get("line1"),
        line2: fd.get("line2") ?? "",
        city: fd.get("city"),
        district: fd.get("district"),
        postalCode: fd.get("postalCode") ?? "",
        country: String(fd.get("country") ?? "BD") || "BD",
      },
    });

    await db.order.update({
      where: { id: input.orderId },
      data: {
        customerName: input.customerName,
        phone: normalizeBdPhone(input.phone),
        email: input.email || null,
        notes: input.notes || null,
        shippingAddress: toJson(input.address),
      },
    });
    await audit(user.id, "order.customer_update", "order", input.orderId);
    revalidateOrder(input.orderId);
    return succeed("Customer details saved.");
  });
}

export async function updateInternalNotesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const orderId = String(fd.get("orderId") ?? "");
    const internalNotes = String(fd.get("internalNotes") ?? "").slice(0, 4000);
    if (!orderId) return fail("Missing order.");
    await db.order.update({ where: { id: orderId }, data: { internalNotes: internalNotes || null } });
    await audit(user.id, "order.internal_notes", "order", orderId);
    revalidateOrder(orderId);
    return succeed("Internal note saved. Customers never see this.");
  });
}

/* ───────────────────────────── items ───────────────────────────── */

export async function updateOrderItemsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const input = orderItemsSchema.parse({
      orderId: fd.get("orderId"),
      items: readJson(fd, "items", [] as { id: string; quantity: number; unitPrice: number }[]),
      shipping: readInt(fd, "shipping_minor", 0),
      discount: readInt(fd, "discount_minor", 0),
    });

    const order = await db.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
    if (!order) return fail("That order no longer exists.");
    if (order.status !== "pending") return fail("Items can only be edited while the order is pending.");

    await db.$transaction(async (tx) => {
      for (const patch of input.items) {
        const existing = order.items.find((i) => i.id === patch.id);
        if (!existing) continue;
        const delta = patch.quantity - existing.quantity;
        if (delta !== 0 && existing.variantId) {
          // qty up → take stock; qty down → give it back
          await tx.productVariant.update({ where: { id: existing.variantId }, data: { stock: { decrement: delta } } }).catch(() => {});
        }
        if (patch.quantity === 0) {
          await tx.orderItem.delete({ where: { id: patch.id } });
        } else {
          await tx.orderItem.update({
            where: { id: patch.id },
            data: { quantity: patch.quantity, unitPrice: patch.unitPrice, total: patch.quantity * patch.unitPrice },
          });
        }
      }
      const remaining = await tx.orderItem.findMany({ where: { orderId: input.orderId } });
      const subtotal = remaining.reduce((a, i) => a + i.total, 0);
      const total = Math.max(0, subtotal - input.discount + input.shipping);
      await tx.order.update({
        where: { id: input.orderId },
        data: { subtotal, discount: input.discount, shipping: input.shipping, total },
      });
    });

    await audit(user.id, "order.items_update", "order", input.orderId, { lines: input.items.length });
    revalidateOrder(input.orderId);
    return succeed("Items and totals recalculated.");
  });
}

/* ───────────────────────────── courier ───────────────────────────── */

export async function updateCourierAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const input = orderCourierSchema.parse({
      orderId: fd.get("orderId"),
      courier: fd.get("courier") ?? "",
      courierTracking: fd.get("courierTracking") ?? "",
      courierUrl: fd.get("courierUrl") ?? "",
    });
    const auto = courierTrackingUrl(input.courier, input.courierTracking);
    await db.order.update({
      where: { id: input.orderId },
      data: {
        courier: input.courier || null,
        courierTracking: input.courierTracking || null,
        courierUrl: input.courierUrl || auto || null,
      },
    });
    if (input.courier && input.courierTracking) {
      await db.orderEvent.create({
        data: {
          orderId: input.orderId,
          type: "shipping",
          title: toJson({ en: `Courier: ${input.courier}`, bn: `কুরিয়ার: ${input.courier}` }),
          message: toJson({
            en: `Tracking number ${input.courierTracking}.`,
            bn: `ট্র্যাকিং নম্বর ${input.courierTracking}।`,
          }),
          isPublic: true,
          createdById: user.id,
        },
      });
    }
    await audit(user.id, "order.courier", "order", input.orderId, { courier: input.courier ?? "" });
    revalidateOrder(input.orderId);
    return succeed("Courier details saved and shared with the customer.");
  });
}

/* ───────────────────────────── timeline ───────────────────────────── */

export async function addOrderEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const input = orderEventSchema.parse({
      orderId: fd.get("orderId"),
      type: fd.get("type") ?? "note",
      title: readI18n(fd, "title"),
      message: readI18n(fd, "message"),
      isPublic: readBool(fd, "isPublic"),
    });
    if (!input.title.en.trim()) return fail("An English title is required.", { title_en: "Required." });

    await db.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: input.type,
        title: toJson({ en: input.title.en, bn: input.title.bn || input.title.en }),
        message:
          input.message && (input.message.en || input.message.bn)
            ? toJson({ en: input.message.en, bn: input.message.bn || input.message.en })
            : null,
        isPublic: input.isPublic,
        createdById: user.id,
      },
    });
    await audit(user.id, "order.event", "order", input.orderId, { type: input.type, isPublic: input.isPublic });
    revalidateOrder(input.orderId);
    return succeed(input.isPublic ? "Event added — visible to the customer and the concierge." : "Internal event added.");
  });
}

export async function deleteOrderEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);
    const id = String(fd.get("eventId") ?? "");
    const row = await db.orderEvent.findUnique({ where: { id }, select: { orderId: true } });
    if (!row) return fail("That event no longer exists.");
    await db.orderEvent.delete({ where: { id } });
    await audit(user.id, "order.event_delete", "order", row.orderId, { eventId: id });
    revalidateOrder(row.orderId);
    return succeed("Event removed.");
  });
}

/* ───────────────────────────── payments ───────────────────────────── */

export async function verifyPaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.verify", fd);
    const input = paymentVerifySchema.parse({
      paymentId: fd.get("paymentId"),
      decision: fd.get("decision"),
      note: fd.get("note") ?? "",
    });

    const payment = await db.payment.findUnique({ where: { id: input.paymentId }, include: { order: true } });
    if (!payment) return fail("That payment record no longer exists.");

    const paid = input.decision === "paid";
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: paid ? "paid" : "failed", verifiedById: user.id, verifiedAt: new Date() },
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: paid ? "paid" : "failed", paidAt: paid ? new Date() : null },
      });
      await tx.orderEvent.create({
        data: {
          orderId: payment.orderId,
          type: "payment",
          title: paid
            ? toJson({ en: "Payment verified", bn: "পেমেন্ট যাচাই সম্পন্ন" })
            : toJson({ en: "Payment could not be verified", bn: "পেমেন্ট যাচাই করা যায়নি" }),
          message: paid
            ? toJson({
                en: `We confirmed ${payment.method === "bkash" ? "bKash" : payment.method === "nagad" ? "Nagad" : payment.method} transaction ${payment.transactionId ?? ""}.`.trim(),
                bn: `আমরা ${payment.transactionId ?? ""} ট্রানজ্যাকশনটি নিশ্চিত করেছি।`.trim(),
              })
            : toJson({
                en: input.note || "We could not find that transaction. Please check the TrxID or send the payment again.",
                bn: input.note || "আমরা ট্রানজ্যাকশনটি খুঁজে পাইনি। TrxID যাচাই করুন বা আবার পেমেন্ট করুন।",
              }),
          isPublic: true,
          createdById: user.id,
        },
      });
    });

    await audit(user.id, paid ? "payment.verify" : "payment.reject", "payment", payment.id, {
      orderId: payment.orderId,
      transactionId: payment.transactionId ?? "",
      amount: payment.amount,
    });
    revalidateOrder(payment.orderId);
    return succeed(paid ? "Payment verified." : "Payment marked as failed.");
  });
}

export async function markOrderPaidAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("payments.verify", fd);
    const orderId = String(fd.get("orderId") ?? "");
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return fail("That order no longer exists.");
    if (order.paymentStatus === "paid") return fail("This order is already marked paid.");

    await db.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "paid", paidAt: new Date() } });
      await tx.payment.create({
        data: {
          orderId,
          method: order.paymentMethod,
          provider: "manual",
          amount: order.total,
          status: "paid",
          verifiedById: user.id,
          verifiedAt: new Date(),
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId,
          type: "payment",
          title: toJson({ en: "Payment received", bn: "পেমেন্ট গৃহীত" }),
          isPublic: true,
          createdById: user.id,
        },
      });
    });
    await audit(user.id, "payment.mark_paid", "order", orderId, { amount: order.total });
    revalidateOrder(orderId);
    return succeed("Marked as paid.");
  });
}

/* ───────────────────────────── manual order ───────────────────────────── */

async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const count = await db.order.count({ where: { number: { startsWith: `ORY-${year}-` } } });
  for (let i = 1; i <= 8; i++) {
    const candidate = formatOrderNumber(count + i);
    const exists = await db.order.findUnique({ where: { number: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `ORY-${year}-${Date.now().toString().slice(-6)}`;
}

async function uniqueTrackingCode() {
  for (let i = 0; i < 8; i++) {
    const code = generateTrackingCode();
    const exists = await db.order.findUnique({ where: { trackingCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  return generateTrackingCode(10);
}

export async function createManualOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("orders.write", fd);

    const input = manualOrderSchema.parse({
      channel: fd.get("channel") ?? "manual",
      customerId: fd.get("customerId") ?? undefined,
      customerName: fd.get("customerName"),
      phone: fd.get("phone"),
      email: fd.get("email") ?? "",
      address: {
        line1: fd.get("line1"),
        line2: fd.get("line2") ?? "",
        city: fd.get("city"),
        district: fd.get("district"),
        postalCode: fd.get("postalCode") ?? "",
        country: String(fd.get("country") ?? "BD") || "BD",
      },
      items: readJson(fd, "items", [] as { variantId: string; quantity: number; unitPrice: number }[]),
      shipping: readInt(fd, "shipping_minor", 0),
      discount: readInt(fd, "discount_minor", 0),
      paymentMethod: fd.get("paymentMethod") ?? "cod",
      paymentStatus: fd.get("paymentStatus") ?? "unpaid",
      status: fd.get("status") ?? "confirmed",
      notes: fd.get("notes") ?? "",
      internalNotes: fd.get("internalNotes") ?? "",
      locale: String(fd.get("locale") ?? "en"),
      decrementStock: readBool(fd, "decrementStock"),
    });

    const variantIds = input.items.map((i) => i.variantId);
    const variants = await db.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } }, image: true },
    });
    if (variants.length !== new Set(variantIds).size) return fail("One of the chosen variants no longer exists.");

    const phone = normalizeBdPhone(input.phone);
    const lines = input.items.map((i) => {
      const v = variants.find((x) => x.id === i.variantId)!;
      const name = (() => {
        try {
          const parsed = JSON.parse(v.product.name) as Record<string, string>;
          return parsed.en ?? parsed.bn ?? v.product.slug;
        } catch {
          return v.product.name;
        }
      })();
      return {
        productId: v.productId,
        variantId: v.id,
        name,
        variantTitle: v.title,
        sku: v.sku,
        image: v.image?.url ?? v.product.images[0]?.url ?? null,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        total: i.unitPrice * i.quantity,
      };
    });
    const subtotal = lines.reduce((a, l) => a + l.total, 0);
    const total = Math.max(0, subtotal - input.discount + input.shipping);
    const zone = await resolveZoneRate(input.address.district, subtotal);
    const trackingCode = await uniqueTrackingCode();
    const h = await headers();

    const order = await db.$transaction(async (tx) => {
      if (input.decrementStock) {
        for (const l of lines) {
          await tx.productVariant.update({ where: { id: l.variantId }, data: { stock: { decrement: l.quantity } } });
        }
      }

      let customerId = input.customerId;
      if (!customerId) {
        const existing = await tx.customer.findFirst({ where: { phone } });
        if (existing) {
          customerId = existing.id;
          await tx.customer.update({ where: { id: existing.id }, data: { name: input.customerName, email: input.email || existing.email } });
        } else {
          const created = await tx.customer.create({
            data: { phone, name: input.customerName, email: input.email || null, locale: input.locale },
          });
          customerId = created.id;
        }
      }

      await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } }).catch(() => {});
      await tx.address
        .create({
          data: {
            customerId,
            name: input.customerName,
            phone,
            line1: input.address.line1,
            line2: input.address.line2 || null,
            city: input.address.city,
            district: input.address.district,
            postalCode: input.address.postalCode || null,
            country: input.address.country,
            isDefault: true,
          },
        })
        .catch(() => {});

      return tx.order.create({
        data: {
          number: await nextOrderNumber(),
          trackingCode,
          customerId,
          status: input.status,
          channel: input.channel,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          currency: "BDT",
          exchangeRate: 1,
          subtotal,
          discount: input.discount,
          shipping: input.shipping,
          total,
          customerName: input.customerName,
          email: input.email || null,
          phone,
          shippingAddress: toJson(input.address),
          shippingZoneId: zone.zoneId,
          notes: input.notes || null,
          internalNotes: input.internalNotes || null,
          locale: input.locale,
          ip: getClientIp(h),
          confirmedAt: input.status === "confirmed" ? new Date() : null,
          paidAt: input.paymentStatus === "paid" ? new Date() : null,
          items: { create: lines },
          events: {
            create: [
              {
                type: "status",
                title: toJson({ en: "Order received", bn: "অর্ডার গৃহীত" }),
                message: toJson({
                  en: `Taken over ${input.channel === "whatsapp" ? "WhatsApp" : input.channel === "messenger" ? "Messenger" : "phone"} by our team.`,
                  bn: "আমাদের টিম আপনার অর্ডার নিয়েছে।",
                }),
                isPublic: true,
                createdById: user.id,
              },
            ],
          },
        },
      });
    });

    if (input.paymentStatus === "paid") {
      await db.payment.create({
        data: {
          orderId: order.id,
          method: input.paymentMethod,
          provider: "manual",
          amount: total,
          status: "paid",
          verifiedById: user.id,
          verifiedAt: new Date(),
        },
      });
    }

    await audit(user.id, "order.manual_create", "order", order.id, { number: order.number, channel: input.channel, total });
    revalidateOrder(order.id);
    return succeed(`Order ${order.number} created.`, { orderId: order.id, number: order.number, trackingCode: order.trackingCode });
  });
}

export async function goToOrderAction(fd: FormData) {
  const id = String(fd.get("orderId") ?? "");
  if (id) redirect(`/admin/orders/${id}`);
  redirect("/admin/orders");
}

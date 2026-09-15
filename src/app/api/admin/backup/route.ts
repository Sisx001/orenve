import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { handleError } from "@/lib/api-server";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Full JSON export of the business data.
 *
 * Deliberately excludes sessions, rate-limit rows and login attempts (all
 * ephemeral) — and it *does* include the settings blob, which holds the AI key,
 * so the file must be treated as a secret.
 */
export async function GET() {
  try {
    const user = await requireUser("backup.run");

    const [
      users,
      categories,
      collections,
      products,
      productCollections,
      productOptions,
      productVariants,
      productImages,
      reviews,
      customers,
      addresses,
      orders,
      orderItems,
      orderEvents,
      payments,
      coupons,
      shippingZones,
      pages,
      blocks,
      media,
      settings,
      translations,
      subscribers,
      contactMessages,
      aiConversations,
      auditLogs,
    ] = await Promise.all([
      db.user.findMany({ select: { id: true, email: true, name: true, role: true, isActive: true, totpEnabled: true, locale: true, avatarUrl: true, createdAt: true } }),
      db.category.findMany(),
      db.collection.findMany(),
      db.product.findMany(),
      db.productCollection.findMany(),
      db.productOption.findMany(),
      db.productVariant.findMany(),
      db.productImage.findMany(),
      db.review.findMany(),
      db.customer.findMany(),
      db.address.findMany(),
      db.order.findMany(),
      db.orderItem.findMany(),
      db.orderEvent.findMany(),
      db.payment.findMany(),
      db.coupon.findMany(),
      db.shippingZone.findMany(),
      db.page.findMany(),
      db.block.findMany(),
      db.media.findMany(),
      db.setting.findMany(),
      db.translation.findMany(),
      db.subscriber.findMany(),
      db.contactMessage.findMany(),
      db.aiConversation.findMany(),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
    ]);

    const payload = {
      meta: {
        app: "ORYNVE",
        version: 2,
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        note: "Password hashes, sessions, rate-limit rows and login attempts are excluded. Settings include secrets — keep this file private.",
      },
      users,
      categories,
      collections,
      products,
      productCollections,
      productOptions,
      productVariants,
      productImages,
      reviews,
      customers,
      addresses,
      orders,
      orderItems,
      orderEvents,
      payments,
      coupons,
      shippingZones,
      pages,
      blocks,
      media,
      settings,
      translations,
      subscribers,
      contactMessages,
      aiConversations,
      auditLogs,
    };

    await audit(user.id, "backup.export", "setting", null, {
      orders: orders.length,
      products: products.length,
      customers: customers.length,
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="orynve-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { CouponsManager, type CouponRow } from "./CouponsManager";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function CouponsPage() {
  await requireStudio("products.write", "/admin/coupons");
  const [coupons, csrf] = await Promise.all([db.coupon.findMany({ orderBy: { createdAt: "desc" } }), csrfToken()]);
  const now = new Date();

  const rows: CouponRow[] = coupons.map((c) => {
    const state: CouponRow["state"] = !c.isActive
      ? "off"
      : c.maxUses != null && c.usedCount >= c.maxUses
        ? "used-up"
        : c.endsAt && c.endsAt < now
          ? "expired"
          : c.startsAt && c.startsAt > now
            ? "scheduled"
            : "active";
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      minSubtotal: c.minSubtotal,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      perCustomer: c.perCustomer,
      startsAt: day(c.startsAt),
      endsAt: day(c.endsAt),
      isActive: c.isActive,
      state,
    };
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title="Coupons" description="Discount codes customers can enter at checkout. Usage counts update as orders come in." />
      <CouponsManager rows={rows} csrf={csrf} />
    </div>
  );
}

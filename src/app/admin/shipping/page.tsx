import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { parseI18n, parseJson } from "@/lib/json";
import { ShippingManager, type ZoneRow } from "./ShippingManager";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  await requireStudio("settings.write", "/admin/shipping");
  const [zones, csrf] = await Promise.all([db.shippingZone.findMany({ orderBy: { sortOrder: "asc" } }), csrfToken()]);

  const rows: ZoneRow[] = zones.map((z) => {
    const districts = parseJson<string[]>(z.districts, []);
    const name = parseI18n(z.name);
    return {
      id: z.id,
      nameEn: name.en ?? "",
      nameBn: name.bn ?? "",
      districts: districts.filter((d) => d !== "*"),
      everywhereElse: districts.includes("*"),
      rate: z.rate,
      freeAbove: z.freeAbove,
      etaMinDays: z.etaMinDays,
      etaMaxDays: z.etaMaxDays,
      isActive: z.isActive,
      sortOrder: z.sortOrder,
    };
  });

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Shipping zones"
        description="Checkout picks the first active zone that lists the customer's district; otherwise the catch-all zone."
      />
      <ShippingManager rows={rows} csrf={csrf} />
    </div>
  );
}

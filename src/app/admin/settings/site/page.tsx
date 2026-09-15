import { headers } from "next/headers";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { getClientIp } from "@/lib/request";
import { SiteForm } from "./SiteForm";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/site");
  const [site, csrf, h] = await Promise.all([getSetting("site"), csrfToken(), headers()]);

  return (
    <div>
      <PageHeader title="Site mode" description="Open the shop, put up a maintenance page, or run a coming-soon countdown." />
      <SiteForm
        csrf={csrf}
        yourIp={getClientIp(h)}
        values={{
          mode: site.mode,
          maintenanceTitleEn: site.maintenanceTitle.en ?? "",
          maintenanceTitleBn: site.maintenanceTitle.bn ?? "",
          maintenanceMessageEn: site.maintenanceMessage.en ?? "",
          maintenanceMessageBn: site.maintenanceMessage.bn ?? "",
          launchDate: site.launchDate,
          maintenanceImage: site.maintenanceImage,
          allowlistIps: site.allowlistIps,
        }}
      />
    </div>
  );
}

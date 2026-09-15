import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { BrandForm } from "./BrandForm";

export const dynamic = "force-dynamic";

export default async function BrandSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/brand");
  const [brand, csrf] = await Promise.all([getSetting("brand"), csrfToken()]);

  return (
    <div>
      <PageHeader title="Brand & theme" description="Name, logo, colour, type and the announcement bar. Everything here applies to the storefront immediately." />
      <BrandForm
        csrf={csrf}
        values={{
          name: brand.name,
          taglineEn: brand.tagline.en ?? "",
          taglineBn: brand.tagline.bn ?? "",
          logoUrl: brand.logoUrl,
          accent: brand.accent,
          brass: brand.brass,
          theme: brand.theme,
          radius: brand.radius,
          fontDisplay: brand.fontDisplay,
          fontSans: brand.fontSans,
          fontBangla: brand.fontBangla,
          announcementEn: brand.announcement.en ?? "",
          announcementBn: brand.announcement.bn ?? "",
          announcementLink: brand.announcementLink,
          showAnnouncement: brand.showAnnouncement,
        }}
      />
    </div>
  );
}

import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { SeoForm } from "./SeoForm";

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/seo");
  const [seo, csrf] = await Promise.all([getSetting("seo"), csrfToken()]);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <PageHeader title="SEO" description="How the storefront looks in search results and when it is shared." />
      <SeoForm
        csrf={csrf}
        appUrl={appUrl}
        values={{
          titleEn: seo.title.en ?? "",
          titleBn: seo.title.bn ?? "",
          descriptionEn: seo.description.en ?? "",
          descriptionBn: seo.description.bn ?? "",
          ogImage: seo.ogImage,
          twitter: seo.twitter,
          gaId: seo.gaId,
          metaPixelId: seo.metaPixelId,
          robotsIndex: seo.robotsIndex,
        }}
      />
    </div>
  );
}

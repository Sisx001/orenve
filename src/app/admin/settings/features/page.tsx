import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { FeaturesForm } from "./FeaturesForm";

export const dynamic = "force-dynamic";

export default async function FeaturesSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/features");
  const [features, csrf] = await Promise.all([getSetting("features"), csrfToken()]);

  return (
    <div>
      <PageHeader title="Features" description="Switch parts of the storefront on and off. Anything off is not rendered at all — no dead code, no wasted requests." />
      <FeaturesForm csrf={csrf} values={features as unknown as Record<string, boolean>} />
    </div>
  );
}

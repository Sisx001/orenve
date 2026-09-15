import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { CurrencyForm } from "./CurrencyForm";

export const dynamic = "force-dynamic";

export default async function CurrencySettingsPage() {
  await requireStudio("settings.write", "/admin/settings/currency");
  const [currency, locale, csrf] = await Promise.all([getSetting("currency"), getSetting("locale"), csrfToken()]);

  return (
    <div>
      <PageHeader title="Currencies & locales" description="Indicative display currencies and the languages the storefront offers." />
      <CurrencyForm csrf={csrf} display={currency.display} locale={locale} />
    </div>
  );
}

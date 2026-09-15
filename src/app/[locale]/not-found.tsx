import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslator } from "@/lib/i18n/server";
import { normalizeLocale } from "@/lib/i18n";
import { COOKIE_LOCALE } from "@/lib/constants";
import { Monogram } from "@/components/brand/Logo";

/** Localised 404 inside the storefront shell. */
export default async function LocaleNotFound() {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(COOKIE_LOCALE)?.value);
  const t = await getTranslator(locale);

  return (
    <section className="section">
      <div className="container-page flex flex-col items-center py-20 text-center">
        <Monogram size={48} className="text-line" />
        <p className="eyebrow mt-10">404</p>
        <h1 className="display mt-5 max-w-2xl text-balance text-display-md">{t("common.notFoundTitle")}</h1>
        <p className="mt-5 max-w-md text-muted">{t("common.notFoundText")}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href={`/${locale}`} className="btn">
            {t("common.backHome")}
          </Link>
          <Link href={`/${locale}/shop`} className="btn-outline">
            {t("nav.shop")}
          </Link>
        </div>
      </div>
    </section>
  );
}

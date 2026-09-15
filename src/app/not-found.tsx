import Link from "next/link";
import { createTranslator, defaultDictionary } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { Monogram } from "@/components/brand/Logo";

/**
 * Root 404 — reached for paths outside the [locale] segment (or when the
 * locale itself is invalid). Renders its own document because the root layout
 * is a pass-through shared with the studio.
 */
export default function RootNotFound() {
  const t = createTranslator(DEFAULT_LOCALE, defaultDictionary);
  return (
    <html lang="en" data-theme="light">
      <body>
        <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
          <Monogram size={48} className="text-line" />
          <p className="eyebrow mt-10">404</p>
          <h1 className="display mt-5 max-w-2xl text-balance text-display-md">{t("common.notFoundTitle")}</h1>
          <p className="mt-5 max-w-md text-muted">{t("common.notFoundText")}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/en" className="btn">
              {t("common.backHome")}
            </Link>
            <Link href="/en/shop" className="btn-outline">
              {t("nav.shop")}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}

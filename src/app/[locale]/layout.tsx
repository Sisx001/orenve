import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCsrfToken } from "@/lib/auth/csrf";
import { getPublicConfig } from "@/lib/settings";
import { getTranslator } from "@/lib/i18n/server";
import { isSupportedLocale } from "@/lib/i18n";
import { COOKIE_CURRENCY, COOKIE_THEME, SUPPORTED_LOCALES } from "@/lib/constants";
import { listCategories, listCollections, getPages } from "@/lib/catalog";
import { i18nText } from "@/lib/json";
import { absoluteUrl } from "@/lib/utils";
import { ThemeStyle } from "@/components/providers/ThemeStyle";
import { StoreProviders } from "@/components/store/StoreProviders";
import { SiteHeader } from "@/components/store/SiteHeader";
import { SiteFooter } from "@/components/store/SiteFooter";
import { CartDrawer } from "@/components/store/CartDrawer";
import { SearchOverlay } from "@/components/store/SearchOverlay";
import { QuickView } from "@/components/store/QuickView";
import { ConciergeWidget } from "@/components/store/ConciergeWidget";
import { WhatsappFloat } from "@/components/store/WhatsappFloat";
import { BrandIntro } from "@/components/store/BrandIntro";
import { CustomCursor } from "@/components/store/CustomCursor";
import { StoreToaster } from "@/components/store/StoreToaster";
import { MaintenanceGate } from "@/components/store/MaintenancePage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const config = await getPublicConfig();
  const seo = config.seo;
  const title = i18nText(seo.title, locale);
  const description = i18nText(seo.description, locale);
  const brand = config.brand.name || "ORYNVE";
  const image = seo.ogImage || "/brand/og.jpg";

  return {
    metadataBase: new URL(absoluteUrl("/")),
    title,
    description,
    applicationName: brand,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: "website",
      siteName: brand,
      title,
      description,
      locale,
      url: `/${locale}`,
      images: [{ url: image, width: 1200, height: 630, alt: brand }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      ...(seo.twitter ? { site: seo.twitter } : {}),
    },
    robots: seo.robotsIndex ? { index: true, follow: true } : { index: false, follow: false },
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    manifest: "/manifest.webmanifest",
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  // Mint the double-submit CSRF cookie up front when the runtime allows it.
  // Next 15 rejects cookie writes during a Server Component render, in which
  // case the client helper bootstraps the token through GET /api/csrf.
  try {
    await getCsrfToken();
  } catch {
    /* cookie is minted lazily by /api/csrf instead */
  }

  const [config, t, jar, categories, collections, pages] = await Promise.all([
    getPublicConfig(),
    getTranslator(locale),
    cookies(),
    listCategories(locale),
    listCollections(locale),
    getPages(locale),
  ]);

  const cookieTheme = jar.get(COOKIE_THEME)?.value;
  const brandTheme = config.brand.theme === "system" ? "light" : config.brand.theme;
  const theme: "light" | "dark" = cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : brandTheme;
  const currency = jar.get(COOKIE_CURRENCY)?.value ?? config.currency.display.find((c) => c.enabled)?.code ?? "BDT";

  const aiOn = config.features.aiConcierge && config.ai.enabled;

  return (
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <head>
        <ThemeStyle
          accent={config.brand.accent}
          brass={config.brand.brass}
          radius={config.brand.radius}
          fontDisplay={config.brand.fontDisplay}
          fontSans={config.brand.fontSans}
          fontBangla={config.brand.fontBangla}
        />
        <meta name="theme-color" content={theme === "dark" ? "#0e0f0c" : "#faf8f3"} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {config.features.pwa && <link rel="manifest" href="/manifest.webmanifest" />}
      </head>
      <body>
        <StoreProviders locale={locale} dict={t.dict} config={config} initialCurrency={currency} initialTheme={theme}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[130] focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:text-[0.7rem] focus:font-semibold focus:uppercase focus:tracking-[0.16em]"
          >
            {t("common.skipToContent")}
          </a>

          <div className="flex min-h-[100dvh] flex-col">
            <SiteHeader
              categories={categories.map((c) => ({ slug: c.slug, name: c.name, image: c.image, count: c.count }))}
              collections={collections.map((c) => ({ slug: c.slug, name: c.name, image: c.image }))}
            />

            <main id="main-content" className="flex-1">
              {config.site.mode !== "live" ? (
                <MaintenanceGate
                  title={i18nText(config.site.maintenanceTitle, locale)}
                  message={i18nText(config.site.maintenanceMessage, locale)}
                  launchDate={config.site.launchDate}
                  image={config.site.maintenanceImage}
                >
                  {children}
                </MaintenanceGate>
              ) : (
                children
              )}
            </main>

            <SiteFooter pages={pages.map((p) => ({ slug: p.slug, title: p.title }))} />
          </div>

          {config.features.cart && <CartDrawer />}
          {config.features.search && <SearchOverlay />}
          {config.features.quickView && <QuickView />}
          {aiOn ? <ConciergeWidget /> : config.contact.whatsapp ? <WhatsappFloat /> : null}
          {config.features.intro && <BrandIntro />}
          {config.features.customCursor && <CustomCursor />}
          <StoreToaster />
        </StoreProviders>
      </body>
    </html>
  );
}

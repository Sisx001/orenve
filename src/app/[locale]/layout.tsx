import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCsrfToken } from "@/lib/auth/csrf";
import { getPublicConfig } from "@/lib/settings";
import { getTranslator } from "@/lib/i18n/server";
import { getEnabledLocales, getLocaleInfo } from "@/lib/i18n/registry";
import { COOKIE_CURRENCY, COOKIE_LOCALE, COOKIE_THEME } from "@/lib/constants";
import { listCategories, listCollections, getPages } from "@/lib/catalog";
import { i18nText } from "@/lib/json";
import { absoluteUrl } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveTheme, getPageThemeOverrides } from "@/lib/theme/resolve";
import { COOKIE_THEME_PREVIEW, effectiveMode, themeColorFor, toClientTheme } from "@/lib/theme/payload";
import { layoutDataAttributes, type ThemeModePreference } from "@/lib/theme/types";
import { ThemeStyle } from "@/components/providers/ThemeStyle";
import { StoreProviders } from "@/components/store/StoreProviders";
import { PageThemeSwitch } from "@/components/store/PageThemeSwitch";
import { ThemePreviewSync } from "@/components/store/ThemePreviewSync";
import { SiteHeader } from "@/components/store/header/SiteHeader";
import { SiteFooter } from "@/components/store/footer/SiteFooter";
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
  const [config, enabled] = await Promise.all([getPublicConfig(), getEnabledLocales()]);
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
      languages: Object.fromEntries(enabled.map((l) => [l.code, `/${l.code}`])),
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
    // Theme previews (studio users only) must never be indexed, whatever the SEO setting says.
    robots: seo.robotsIndex && !(await cookies()).get(COOKIE_THEME_PREVIEW)?.value ? { index: true, follow: true } : { index: false, follow: false },
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    manifest: "/manifest.webmanifest",
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  // The registry decides which languages exist. Unknown or switched-off
  // languages are not reachable — the storefront 404s instead of falling back,
  // so a disabled language never leaks through a stale link.
  const localeInfo = await getLocaleInfo(locale);
  if (!localeInfo || !localeInfo.enabled) notFound();

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

  // Remember the choice for requests that arrive without a prefix. Only known
  // languages get here, so the middleware can trust the cookie.
  if (jar.get(COOKIE_LOCALE)?.value !== locale) {
    try {
      jar.set(COOKIE_LOCALE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    } catch {
      /* Next 15 forbids cookie writes during render — the middleware sets it too */
    }
  }

  const currency = jar.get(COOKIE_CURRENCY)?.value ?? config.currency.display.find((c) => c.enabled)?.code ?? "BDT";

  /* ── Theme ───────────────────────────────────────────────────────────────
     The layout resolves the *global* theme: the orynve preset overlaid with
     brand settings, the active theme, and any assignment whose pattern covers
     the whole storefront. Page-scoped assignments cannot be resolved here
     (a layout has no access to the pathname), so they are handed to
     `PageThemeSwitch` and applied on the client — see its file comment.

     Preview is gated on a real studio session; the cookie alone proves nothing. */
  const user = await getCurrentUser();
  const allowPreview = !!user;
  const previewId = allowPreview ? jar.get(COOKIE_THEME_PREVIEW)?.value ?? null : null;

  const [theme, pageOverrides] = await Promise.all([
    resolveTheme({ pathname: "*", locale, previewId, allowPreview }),
    getPageThemeOverrides({ locale }),
  ]);

  // The visitor's stored preference may name a mode the owner has switched off;
  // `effectiveMode` falls back to the first enabled mode in that case. "system"
  // renders as light on the server and is corrected before paint by the inline
  // bootstrap script below, so there is no flash.
  const cookieMode = jar.get(COOKIE_THEME)?.value;
  const preference: ThemeModePreference = cookieMode === "dark" || cookieMode === "light" || cookieMode === "black" || cookieMode === "system" ? cookieMode : theme.defaultMode;
  const mode = effectiveMode(preference, theme.modes);
  const clientTheme = toClientTheme(theme, preference, mode);
  const isPreview = theme.source === "preview";

  /* Runs before first paint: when the preference is "system" (or absent and the
     owner's default is "system"), swap <html data-theme> to match the device so
     a dark-mode visitor never sees a white flash. */
  const bootstrap = `(function(){try{var m=document.cookie.match(/(?:^|; )ory_theme=([^;]*)/);var p=m?decodeURIComponent(m[1]):${JSON.stringify(theme.defaultMode)};if(p!=="system")return;var on=${JSON.stringify(theme.modes)};var d=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var next=d?(on.dark?"dark":on.black?"black":"light"):(on.light?"light":on.dark?"dark":"black");var r=document.documentElement;r.setAttribute("data-theme",next);r.style.colorScheme=next==="light"?"light":"dark";}catch(e){}})();`;

  const aiOn = config.features.aiConcierge && config.ai.enabled;

  return (
    <html
      lang={locale}
      dir={localeInfo.dir}
      data-theme={mode}
      data-eyebrows={theme.layout.uppercaseEyebrows ? "caps" : "sentence"}
      {...layoutDataAttributes(theme.layout)}
      suppressHydrationWarning
    >
      <head>
        <ThemeStyle theme={theme} languages={config.locales.map((l) => ({ code: l.code, font: l.font, dir: l.dir }))} />
        <meta name="theme-color" content={themeColorFor(mode, { light: `rgb(${theme.light.paper})`, dark: `rgb(${theme.dark.paper})`, black: `rgb(${theme.black.paper})` })} />
        <meta name="color-scheme" content={mode === "light" ? "light" : "dark"} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {config.features.pwa && <link rel="manifest" href="/manifest.webmanifest" />}
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body>
        <StoreProviders locale={locale} dict={t.dict} config={config} initialCurrency={currency} theme={clientTheme}>
          {pageOverrides.length > 0 && <PageThemeSwitch entries={pageOverrides.map((o) => ({ id: o.id, pattern: o.pattern, css: o.css, layout: o.layout }))} baseLayout={theme.layout} />}
          {allowPreview && (
            // useSearchParams() needs a Suspense boundary to keep the rest of
            // the layout statically renderable.
            <Suspense fallback={null}>
              <ThemePreviewSync current={previewId} />
            </Suspense>
          )}
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

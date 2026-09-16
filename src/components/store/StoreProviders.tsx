"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { I18nProvider } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n";
import { ConfigProvider } from "@/components/providers/ConfigProvider";
import { ThemeProvider, type ThemeClientPayload } from "@/lib/theme/client";
import type { PublicConfig } from "@/lib/settings";

/**
 * Client provider stack for the storefront.
 *
 * `ThemeProvider` sits above `ConfigProvider` because the config context
 * re-exports the colour-mode state. `MotionConfig` combines two switches:
 *   • `features.animations` — the owner's global kill switch
 *   • `layout.motion` — the theme's motion level: "none" removes all motion,
 *     "reduced" keeps CSS hover transitions (they are driven by
 *     `[data-motion="reduced"]` rules in globals.css) but turns Framer's large
 *     scroll reveals into instant state changes, "full" defers to the visitor's
 *     own `prefers-reduced-motion` setting.
 */
export function StoreProviders({
  locale,
  dict,
  config,
  initialCurrency,
  theme,
  children,
}: {
  locale: string;
  dict: Dictionary;
  config: PublicConfig;
  initialCurrency: string;
  theme: ThemeClientPayload;
  children: ReactNode;
}) {
  const reducedMotion = !config.features.animations || theme.layout.motion !== "full" ? "always" : "user";

  return (
    <I18nProvider locale={locale} dict={dict}>
      <ThemeProvider theme={theme}>
        <ConfigProvider config={config} initialCurrency={initialCurrency}>
          <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>
        </ConfigProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

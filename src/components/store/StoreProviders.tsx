"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { I18nProvider } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n";
import { ConfigProvider } from "@/components/providers/ConfigProvider";
import type { PublicConfig } from "@/lib/settings";

/**
 * Client provider stack for the storefront. ConfigProvider needs the locale,
 * so it lives inside I18nProvider; MotionConfig turns every animation into an
 * instant state change when the owner disables animations or the visitor
 * prefers reduced motion.
 */
export function StoreProviders({
  locale,
  dict,
  config,
  initialCurrency,
  initialTheme,
  children,
}: {
  locale: string;
  dict: Dictionary;
  config: PublicConfig;
  initialCurrency: string;
  initialTheme: "light" | "dark";
  children: ReactNode;
}) {
  return (
    <I18nProvider locale={locale} dict={dict}>
      <ConfigProvider config={config} initialCurrency={initialCurrency} initialTheme={initialTheme}>
        <MotionConfig reducedMotion={config.features.animations ? "user" : "always"}>{children}</MotionConfig>
      </ConfigProvider>
    </I18nProvider>
  );
}

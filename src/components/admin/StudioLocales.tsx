"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StudioLocale = {
  code: string;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  font?: string | null;
};

const DEFAULT_LOCALES: StudioLocale[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr" },
];

const StudioLocalesCtx = createContext<StudioLocale[]>(DEFAULT_LOCALES);

/**
 * Mount this in the admin layout with `locales` sourced from the language
 * registry. Anything that calls `useStudioLocales()` inside will receive the
 * full list; outside a provider the safe default (en + bn) is returned.
 *
 * Contract for the orchestrator:
 *   <StudioLocalesProvider locales={registeredLanguages}>
 *     {children}
 *   </StudioLocalesProvider>
 *
 * where `registeredLanguages: StudioLocale[]` comes from the Language table.
 */
export function StudioLocalesProvider({
  locales,
  children,
}: {
  locales: StudioLocale[];
  children: ReactNode;
}) {
  const resolved = locales.length > 0 ? locales : DEFAULT_LOCALES;
  return (
    <StudioLocalesCtx.Provider value={resolved}>
      {children}
    </StudioLocalesCtx.Provider>
  );
}

/** Returns the registered studio locales, defaulting to [en, bn] when no provider is mounted. */
export function useStudioLocales(): StudioLocale[] {
  return useContext(StudioLocalesCtx);
}

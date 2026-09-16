import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { can, getCurrentUser } from "@/lib/auth/session";
import { PERMISSIONS, COOKIE_STUDIO_THEME } from "@/lib/constants";
import { getEnabledLocales } from "@/lib/i18n/registry";
import { StudioLocalesProvider } from "@/components/admin/StudioLocales";
import { getSetting } from "@/lib/settings";
import { getShellCounts } from "@/lib/admin/queries";
import "../globals.css";
import "./studio.css";

export const metadata: Metadata = {
  title: "ORYNVE Studio",
  description: "Owner studio for the ORYNVE storefront.",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0f0c",
};

/**
 * Inline script that resolves the "system" studio theme before first paint.
 * Must be synchronous and tiny — runs in <head>.
 */
const SYSTEM_THEME_SCRIPT = `(function(){try{var m=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.dataset.studioTheme=m?'dark':'light';}catch(e){}})();`;

/**
 * Studio root. Renders its own document (the app root layout is a pass-through).
 *
 * Studio theme contract:
 *   - Cookie `ory_studio_theme` = "light" | "dark" | "system"
 *   - Fallback: `theme` setting's `studioTheme` field (default "light")
 *   - html[data-studio-theme="light|dark"] drives studio.css token overrides
 *   - For "system": server renders data-studio-theme="light" initially; an
 *     inline <script> in <head> corrects it before paint based on prefers-color-scheme
 *   - Toaster follows via the StudioToaster wrapper in AdminShell
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <html lang="en" data-theme="light" data-studio-theme="light" suppressHydrationWarning>
        <body className="min-h-[100dvh] bg-paper text-ink antialiased">
          {children}
          <Toaster position="top-right" theme="light" richColors closeButton />
        </body>
      </html>
    );
  }

  const permissions = Object.fromEntries(Object.keys(PERMISSIONS).map((p) => [p, can(user, p)]));
  const locales = (await getEnabledLocales()).map((l) => ({
    code: l.code,
    name: l.name,
    nativeName: l.nativeName,
    dir: l.dir,
    font: l.font,
  }));

  // Resolve studio theme: cookie → setting default → "light"
  const jar = await cookies();
  const cookieTheme = jar.get(COOKIE_STUDIO_THEME)?.value as "light" | "dark" | "system" | undefined;
  const themeSetting = (await getSetting("theme")).studioTheme as "light" | "dark" | "system";
  const studioThemePref: "light" | "dark" | "system" = cookieTheme ?? themeSetting;

  // The attribute we write server-side (system → "light" initially, corrected by script)
  const dataStudioTheme: "light" | "dark" = studioThemePref === "dark" ? "dark" : "light";

  const shellCounts = await getShellCounts();

  return (
    <html lang="en" data-theme="light" data-studio-theme={dataStudioTheme} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: correct data-studio-theme to match OS preference before first paint */}
        {studioThemePref === "system" && (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
        )}
      </head>
      <body className="bg-paper text-ink antialiased">
        <StudioLocalesProvider locales={locales}>
          <AdminShell
            user={{ id: user.id, name: user.name, email: user.email, role: user.role, totpEnabled: user.totpEnabled }}
            permissions={permissions}
            shellCounts={shellCounts}
            initialStudioTheme={studioThemePref}
          >
            {children}
          </AdminShell>
        </StudioLocalesProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}

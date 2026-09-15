import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { can, getCurrentUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/constants";
import "../globals.css";

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
 * Studio root. Renders its own document (the app root layout is a pass-through).
 *
 * When there is no session the children are rendered bare — that serves
 * /admin/login. Every other studio page calls `requireStudio()` first, which
 * redirects to the login screen, so a stale cookie can never reveal chrome.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <html lang="en" data-theme="light" suppressHydrationWarning>
        <body className="min-h-[100dvh] bg-paper text-ink antialiased">
          {children}
          <Toaster position="top-right" theme="light" richColors closeButton />
        </body>
      </html>
    );
  }

  const permissions = Object.fromEntries(Object.keys(PERMISSIONS).map((p) => [p, can(user, p)]));

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="bg-paper text-ink antialiased">
        <AdminShell
          user={{ id: user.id, name: user.name, email: user.email, role: user.role, totpEnabled: user.totpEnabled }}
          permissions={permissions}
        >
          {children}
        </AdminShell>
        <Toaster position="top-right" theme="light" richColors closeButton />
      </body>
    </html>
  );
}

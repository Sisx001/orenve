import type { ReactNode } from "react";
import "./globals.css";

/**
 * Root layout is intentionally minimal: <html lang> and theme are set by the
 * [locale] storefront layout and the /admin layout respectively.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

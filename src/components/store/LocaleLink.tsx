"use client";

import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { useLocale } from "@/lib/i18n/client";
import { localizedPath } from "@/lib/i18n";

type Props = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string };

/**
 * Internal link that always carries the active locale prefix.
 * Absolute URLs, mailto:, tel: and #anchors pass through untouched.
 */
export const LocaleLink = forwardRef<HTMLAnchorElement, Props>(function LocaleLink({ href, ...rest }, ref) {
  const locale = useLocale();
  const external = /^([a-z]+:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#");
  return <Link ref={ref} href={external ? href : localizedPath(href, locale)} {...rest} />;
});

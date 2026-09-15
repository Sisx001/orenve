import type { MetadataRoute } from "next";
import { getSetting } from "@/lib/settings";
import { i18nText } from "@/lib/json";
import { DEFAULT_LOCALE } from "@/lib/constants";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [brand, seo, locale] = await Promise.all([getSetting("brand"), getSetting("seo"), getSetting("locale")]);
  const lang = locale.default || DEFAULT_LOCALE;
  const name = brand.name || "ORYNVE";

  return {
    name,
    short_name: name,
    description: i18nText(seo.description, lang),
    start_url: `/${lang}`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f3",
    theme_color: brand.theme === "dark" ? "#0e0f0c" : "#faf8f3",
    lang,
    dir: "ltr",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

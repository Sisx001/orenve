import type { MetadataRoute } from "next";
import { getSetting } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSetting("seo");
  return {
    rules: seo.robotsIndex
      ? [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/api", "/api/", "/*/checkout", "/*/order/", "/*/wishlist"] }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}

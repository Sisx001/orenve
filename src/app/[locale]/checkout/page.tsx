import type { Metadata } from "next";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicConfig } from "@/lib/settings";
import { CheckoutFlow } from "@/components/store/CheckoutFlow";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, config] = await Promise.all([getTranslator(locale), getPublicConfig()]);
  return {
    title: `${t("checkout.eyebrow")} | ${config.brand.name || "ORYNVE"}`,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ channel?: string }>;
}) {
  const [, sp, config] = await Promise.all([params, searchParams, getPublicConfig()]);

  const requested = sp.channel === "whatsapp" || sp.channel === "messenger" ? sp.channel : "website";
  const allowed =
    requested === "whatsapp" && config.checkout.whatsapp
      ? "whatsapp"
      : requested === "messenger" && config.checkout.messenger
        ? "messenger"
        : config.checkout.website
          ? "website"
          : config.checkout.whatsapp
            ? "whatsapp"
            : "website";

  return <CheckoutFlow initialChannel={allowed} />;
}

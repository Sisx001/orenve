import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findOrderByTrackingCode } from "@/lib/orders/service";
import { getTranslator } from "@/lib/i18n/server";
import { OrderView } from "@/components/store/OrderView";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; code: string }> }): Promise<Metadata> {
  const { locale, code } = await params;
  const t = await getTranslator(locale);
  return { title: `${t("tracking.title")} · ${code.toUpperCase()}`, robots: { index: false, follow: false } };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<{ placed?: string; payment?: string }>;
}) {
  const [{ locale, code }, sp] = await Promise.all([params, searchParams]);
  const order = await findOrderByTrackingCode(code, locale);
  if (!order) notFound();

  const paymentState = sp.payment === "paid" || sp.payment === "failed" || sp.payment === "cancelled" ? sp.payment : null;

  return (
    <div className="container-page py-14 md:py-20">
      <OrderView order={order} placed={sp.placed === "1"} paymentState={paymentState} />
    </div>
  );
}

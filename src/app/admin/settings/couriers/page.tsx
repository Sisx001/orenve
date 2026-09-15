import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { CourierForm } from "./CourierForm";

export const dynamic = "force-dynamic";

export default async function CourierSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/couriers");
  const [c, csrf] = await Promise.all([getSetting("courier"), csrfToken()]);
  const env = {
    pathao: Boolean(process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET && process.env.PATHAO_USERNAME && process.env.PATHAO_PASSWORD && process.env.PATHAO_STORE_ID),
    steadfast: Boolean(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY),
    redx: Boolean(process.env.REDX_ACCESS_TOKEN),
    paperfly: Boolean(process.env.PAPERFLY_USERNAME && process.env.PAPERFLY_PASSWORD && process.env.PAPERFLY_KEY),
  };
  const stored = {
    pathao: Boolean(c.pathao.clientId && c.pathao.clientSecret && c.pathao.username && c.pathao.password && c.pathao.storeId),
    steadfast: Boolean(c.steadfast.apiKey && c.steadfast.secretKey),
    redx: Boolean(c.redx.accessToken),
    paperfly: Boolean(c.paperfly.username && c.paperfly.password && c.paperfly.merchantKey),
  };
  return (
    <div>
      <PageHeader title="Couriers" description="Book consignments with Pathao, Steadfast, RedX or Paperfly from the order screen, or record any courier manually. Status updates flow into the customer's tracking timeline." />
      <CourierForm
        csrf={csrf}
        env={env}
        stored={stored}
        values={{
          defaultProvider: c.defaultProvider,
          autoBookOnConfirm: c.autoBookOnConfirm,
          autoSyncMinutes: c.autoSyncMinutes,
          defaultWeightKg: c.defaultWeightKg,
          manualCouriers: c.manualCouriers.join(", "),
          pathao: { enabled: c.pathao.enabled, sandbox: c.pathao.sandbox, baseUrl: c.pathao.baseUrl, storeId: c.pathao.storeId },
          steadfast: { enabled: c.steadfast.enabled, baseUrl: c.steadfast.baseUrl },
          redx: { enabled: c.redx.enabled, sandbox: c.redx.sandbox, baseUrl: c.redx.baseUrl, pickupStoreId: c.redx.pickupStoreId },
          paperfly: { enabled: c.paperfly.enabled, baseUrl: c.paperfly.baseUrl },
        }}
        cronConfigured={Boolean(process.env.CRON_SECRET)}
      />
    </div>
  );
}

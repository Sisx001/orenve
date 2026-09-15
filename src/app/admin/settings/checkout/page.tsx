import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/checkout");
  const [checkout, contact, csrf] = await Promise.all([getSetting("checkout"), getSetting("contact"), csrfToken()]);
  const g = checkout.gateways;

  // Env presence is read on the server and only reported as a boolean.
  const env = {
    sslcommerz: Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    bkash: Boolean(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET && process.env.BKASH_USERNAME && process.env.BKASH_PASSWORD),
    nagad: Boolean(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_MERCHANT_PRIVATE_KEY && process.env.NAGAD_PG_PUBLIC_KEY),
    aamarpay: Boolean(process.env.AAMARPAY_STORE_ID && process.env.AAMARPAY_SIGNATURE_KEY),
    shurjopay: Boolean(process.env.SHURJOPAY_USERNAME && process.env.SHURJOPAY_PASSWORD),
    whatsapp: Boolean(contact.whatsapp),
    messenger: Boolean(contact.messengerPage),
  };
  // Studio-stored credentials are only reported as "set / not set".
  const stored = {
    bkash: Boolean(g.bkash.appKey && g.bkash.appSecret && g.bkash.username && g.bkash.password),
    nagad: Boolean(g.nagad.merchantId && g.nagad.merchantPrivateKey && g.nagad.pgPublicKey),
    aamarpay: Boolean(g.aamarpay.storeId && g.aamarpay.signatureKey),
    shurjopay: Boolean(g.shurjopay.username && g.shurjopay.password),
    sslcommerz: Boolean(g.sslcommerz.storeId && g.sslcommerz.storePassword),
  };

  return (
    <div>
      <PageHeader title="Checkout & payments" description="How customers order and how they pay. Gateway keys can live here or in environment variables; the studio value wins." />
      <CheckoutForm
        csrf={csrf}
        env={env}
        stored={stored}
        sandbox={{ bkash: g.bkash.sandbox, nagad: g.nagad.sandbox, aamarpay: g.aamarpay.sandbox, shurjopay: g.shurjopay.sandbox, sslcommerz: g.sslcommerz.sandbox }}
        prefixes={{ shurjopay: g.shurjopay.prefix }}
        values={{
          whatsapp: checkout.whatsapp,
          messenger: checkout.messenger,
          website: checkout.website,
          cod: checkout.cod,
          bkash: checkout.bkash,
          nagad: checkout.nagad,
          bkash_checkout: checkout.bkash_checkout,
          nagad_checkout: checkout.nagad_checkout,
          sslcommerz: checkout.sslcommerz,
          aamarpay: checkout.aamarpay,
          shurjopay: checkout.shurjopay,
          stripe: checkout.stripe,
          codFee: checkout.codFee,
          codMaxOrder: checkout.codMaxOrder,
          bkashNumber: checkout.bkashNumber,
          nagadNumber: checkout.nagadNumber,
          mfsInstructionsEn: checkout.mfsInstructions.en ?? "",
          mfsInstructionsBn: checkout.mfsInstructions.bn ?? "",
          requireEmail: checkout.requireEmail,
          guestCheckout: checkout.guestCheckout,
          minOrder: checkout.minOrder,
          notesEnabled: checkout.notesEnabled,
          whatsappTemplateEn: checkout.whatsappTemplate.en ?? "",
          whatsappTemplateBn: checkout.whatsappTemplate.bn ?? "",
          autoConfirmCod: checkout.autoConfirmCod,
        }}
      />
    </div>
  );
}

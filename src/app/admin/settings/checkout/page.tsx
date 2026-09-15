import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/checkout");
  const [checkout, contact, csrf] = await Promise.all([getSetting("checkout"), getSetting("contact"), csrfToken()]);

  // Env presence is read on the server and only reported as a boolean.
  const env = {
    sslcommerz: Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    whatsapp: Boolean(contact.whatsapp),
    messenger: Boolean(contact.messengerPage),
  };

  return (
    <div>
      <PageHeader title="Checkout & payments" description="How customers order and how they pay. Manual mobile money is verified from the order screen." />
      <CheckoutForm
        csrf={csrf}
        env={env}
        values={{
          whatsapp: checkout.whatsapp,
          messenger: checkout.messenger,
          website: checkout.website,
          cod: checkout.cod,
          bkash: checkout.bkash,
          nagad: checkout.nagad,
          sslcommerz: checkout.sslcommerz,
          stripe: checkout.stripe,
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

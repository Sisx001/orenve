import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";

export default async function ContactSettingsPage() {
  await requireStudio("settings.write", "/admin/settings/contact");
  const [contact, csrf] = await Promise.all([getSetting("contact"), csrfToken()]);

  return (
    <div>
      <PageHeader title="Contact channels" description="How customers reach you — and where WhatsApp ordering and concierge hand-off point." />
      <ContactForm
        csrf={csrf}
        values={{
          whatsapp: contact.whatsapp,
          messengerPage: contact.messengerPage,
          instagram: contact.instagram,
          facebook: contact.facebook,
          tiktok: contact.tiktok,
          email: contact.email,
          phone: contact.phone,
          addressEn: contact.address.en ?? "",
          addressBn: contact.address.bn ?? "",
          hoursEn: contact.hours.en ?? "",
          hoursBn: contact.hours.bn ?? "",
          mapUrl: contact.mapUrl,
        }}
      />
    </div>
  );
}

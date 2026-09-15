"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Save } from "lucide-react";
import { I18nInput, SubmitButton, TextField } from "@/components/admin/Fields";
import { Section } from "@/components/admin/PageHeader";
import { saveContactAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";

export type ContactValues = {
  whatsapp: string;
  messengerPage: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  email: string;
  phone: string;
  addressEn: string;
  addressBn: string;
  hoursEn: string;
  hoursBn: string;
  mapUrl: string;
};

export function ContactForm({ values, csrf }: { values: ContactValues; csrf: string }) {
  const [state, action] = useActionState(saveContactAction, idleState);
  const [whatsapp, setWhatsapp] = useState(values.whatsapp);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const waDigits = whatsapp.replace(/\D/g, "");

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      <CsrfInput value={csrf} />

      <Section title="Talk to customers" description="These power the WhatsApp ordering flow and the concierge hand-off.">
        <TextField
          name="whatsapp"
          label="WhatsApp business number"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="8801XXXXXXXXX"
          hint="Country code without the plus — Bangladesh numbers start 880."
        />
        {waDigits.length >= 10 && (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-oxide hover:underline"
          >
            <MessageCircle className="h-3 w-3" />
            Test wa.me/{waDigits}
          </a>
        )}
        <TextField name="messengerPage" label="Messenger page" defaultValue={values.messengerPage} placeholder="orynve" hint="Just the page name — it becomes m.me/<name>." className="mt-4" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField name="phone" label="Phone" defaultValue={values.phone} placeholder="+880 1XXX XXXXXX" />
          <TextField name="email" type="email" label="Email" defaultValue={values.email} placeholder="hello@orynve.com" />
        </div>
      </Section>

      <Section title="Social">
        <div className="space-y-4">
          <TextField name="instagram" label="Instagram" defaultValue={values.instagram} placeholder="orynve" hint="Handle or full URL." />
          <TextField name="facebook" label="Facebook" defaultValue={values.facebook} placeholder="orynve" />
          <TextField name="tiktok" label="TikTok" defaultValue={values.tiktok} placeholder="orynve" />
        </div>
      </Section>

      <Section title="Where & when">
        <I18nInput name="address" label="Address" en={values.addressEn} bn={values.addressBn} multiline rows={2} layout="stack" />
        <I18nInput name="hours" label="Opening hours" en={values.hoursEn} bn={values.hoursBn} layout="stack" className="mt-4" />
        <TextField name="mapUrl" label="Google Maps link" defaultValue={values.mapUrl} placeholder="https://maps.app.goo.gl/…" className="mt-4" />
      </Section>

      <Section title="">
        <p className="mb-4 text-xs text-muted">
          The AI concierge quotes these details to customers, so keep them accurate. Hours should say when someone actually replies.
        </p>
        <SubmitButton className="w-full" pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" />
          Save contact channels
        </SubmitButton>
      </Section>
    </form>
  );
}

export default ContactForm;

"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { CsrfInput } from "@/components/admin/Csrf";
import { FormBanner, SubmitButton, TextAreaField, TextField, ToggleRow } from "@/components/admin/Fields";
import { idleState } from "@/lib/admin/action-state";
import { saveI18nSettingsAction } from "@/lib/admin/actions/i18n";

export type EngineValues = {
  glossary: string;
  autoTranslateNewContent: boolean;
  showMachineBadge: boolean;
  batchSize: number;
};

export function EngineSettingsForm({ csrf, values }: { csrf: string; values: EngineValues }) {
  const [state, action] = useActionState(saveI18nSettingsAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <CsrfInput value={csrf} />
      <FormBanner state={state} />

      <TextAreaField
        name="glossary"
        label="Glossary — never translated"
        defaultValue={values.glossary}
        rows={3}
        hint="Comma separated. Brand names, payment methods, anything that must stay in English in every language."
      />

      <TextField
        name="batchSize"
        label="Strings per AI call"
        defaultValue={String(values.batchSize)}
        inputMode="numeric"
        hint="5–80. Lower is slower but safer on models with small context windows."
      />

      <div className="border-t border-line pt-1">
        <ToggleRow
          name="autoTranslateNewContent"
          label="Translate new content automatically"
          hint="When a product or page is saved, queue it for every enabled language."
          defaultChecked={values.autoTranslateNewContent}
        />
        <ToggleRow
          name="showMachineBadge"
          label="Show a machine-translation notice"
          hint="A small line in the storefront footer for languages that are still marked machine translated."
          defaultChecked={values.showMachineBadge}
        />
      </div>

      <SubmitButton className="w-full" pendingLabel="Saving…">
        <Save className="h-3.5 w-3.5" aria-hidden /> Save engine settings
      </SubmitButton>
    </form>
  );
}

export default EngineSettingsForm;

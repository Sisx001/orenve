"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { CsrfInput } from "@/components/admin/Csrf";
import { FormBanner, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { idleState } from "@/lib/admin/action-state";
import { addLanguageAction } from "@/lib/admin/actions/i18n";
import { LANGUAGE_PRESETS, PRESET_BY_CODE } from "./presets";

export function AddLanguageForm({ csrf, existing }: { csrf: string; existing: string[] }) {
  const [state, action] = useActionState(addLanguageAction, idleState);
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nativeName, setNativeName] = useState("");
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  const [font, setFont] = useState("");
  const [flag, setFlag] = useState("");

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) {
      toast.success(state.message);
      setCode("");
      setName("");
      setNativeName("");
      setFont("");
      setFlag("");
      setDir("ltr");
      router.refresh();
    }
  }, [state, router]);

  /** Typing or picking a known code fills in the rest. */
  function applyCode(value: string) {
    const next = value.trim().toLowerCase();
    setCode(next);
    const preset = PRESET_BY_CODE.get(next);
    if (!preset) return;
    setName(preset.name);
    setNativeName(preset.nativeName);
    setDir(preset.dir);
    setFont(preset.font);
    setFlag(preset.flag);
  }

  const available = LANGUAGE_PRESETS.filter((p) => !existing.includes(p.code));

  return (
    <form action={action} className="space-y-3">
      <CsrfInput value={csrf} />
      <FormBanner state={state} />

      <TextField
        name="code"
        label="Language code"
        required
        value={code}
        onChange={(e) => applyCode(e.target.value)}
        list="orynve-language-presets"
        placeholder="hi"
        autoComplete="off"
        error={state.fieldErrors?.code}
        hint="BCP-47 primary subtag, 2–3 letters. Picking a known code fills in the name, direction and a font for the script."
        inputClassName="font-mono"
      />
      <datalist id="orynve-language-presets">
        {available.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name} — {p.nativeName}
          </option>
        ))}
      </datalist>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="name" label="English name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Hindi" />
        <TextField
          name="nativeName"
          label="Native name"
          required
          value={nativeName}
          onChange={(e) => setNativeName(e.target.value)}
          placeholder="हिन्दी"
          lang={code || undefined}
        />
        <SelectField
          name="dir"
          label="Script direction"
          value={dir}
          onChange={(e) => setDir(e.target.value === "rtl" ? "rtl" : "ltr")}
          options={[
            { value: "ltr", label: "Left to right" },
            { value: "rtl", label: "Right to left" },
          ]}
        />
        <TextField name="flag" label="Flag" value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="🇮🇳" />
      </div>

      <TextField
        name="font"
        label="Google Font for this script"
        value={font}
        onChange={(e) => setFont(e.target.value)}
        placeholder="Noto Sans Devanagari"
        hint="Loaded only on pages in this language and scoped to [lang] so the rest of the site keeps the brand type."
      />

      <ToggleRow
        name="enabled"
        label="Show on the storefront immediately"
        hint="Leave off until the AI dictionary has been generated and reviewed."
      />

      <SubmitButton className="w-full" pendingLabel="Adding…">
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add language
      </SubmitButton>
    </form>
  );
}

export default AddLanguageForm;

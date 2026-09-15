"use client";

import { CsrfInput } from "@/components/admin/Csrf";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { FormBanner, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { addGeoOverrideAction, deleteGeoOverrideAction, hideGeoEntryAction, saveGeoAction } from "@/lib/admin/actions/settings";
import { idleState } from "@/lib/admin/action-state";

type Level = "division" | "district" | "upazila" | "area" | "postcode";

function useToast(state: { ok?: boolean; error?: string | null; message?: string | null }) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);
}

export function AddressSettingsForm({ csrf, values }: { csrf: string; values: { levels: Level[]; autoDetect: boolean; requirePostcode: boolean; allowCustomArea: boolean; internationalShipping: boolean } }) {
  const [state, action] = useActionState(saveGeoAction, idleState);
  useToast(state);
  const has = (l: Level) => values.levels.includes(l);
  return (
    <form action={action} className="space-y-4">
      <CsrfInput value={csrf} />
      <FormBanner state={state} />
      <div className="divide-y divide-line/70">
        <ToggleRow name="level_division" label="Division" hint="Optional first step; narrows the district list." defaultChecked={has("division")} />
        <ToggleRow name="level_district" label="District" hint="Always shown — required for delivery zones." defaultChecked disabled />
        <ToggleRow name="level_upazila" label="Upazila / Thana" hint="Cascades from district." defaultChecked={has("upazila")} />
        <ToggleRow name="level_area" label="Area" hint="Dhaka city areas are bundled; other districts use free text with suggestions." defaultChecked={has("area")} />
        <ToggleRow name="level_postcode" label="Postcode" hint="Suggests post offices for the chosen district / upazila." defaultChecked={has("postcode")} />
      </div>
      <div className="divide-y divide-line/70 border-t border-line pt-2">
        <ToggleRow name="autoDetect" label="Location auto-detect" hint="“Use my location” button (GPS) with IP fallback." defaultChecked={values.autoDetect} />
        <ToggleRow name="allowCustomArea" label="Allow typing a custom area" hint="Off forces a pick from the list." defaultChecked={values.allowCustomArea} />
        <ToggleRow name="requirePostcode" label="Require postcode" defaultChecked={values.requirePostcode} />
        <ToggleRow name="internationalShipping" label="International addresses" hint="Shows a country selector and free-text address for non-BD customers." defaultChecked={values.internationalShipping} />
      </div>
      <SubmitButton pendingLabel="Saving…">
        <Save className="h-3.5 w-3.5" /> Save address settings
      </SubmitButton>
    </form>
  );
}

type Override = { id: string; level: string; parentId: string | null; en: string; bn: string | null; code: string | null; isHidden: boolean; targetKey: string | null };

export function GeoOverrides({ csrf, divisions, districts, overrides }: { csrf: string; divisions: { id: string; en: string }[]; districts: { id: string; en: string; bn: string; divisionId: string }[]; overrides: Override[] }) {
  const [addState, addAction] = useActionState(addGeoOverrideAction, idleState);
  const [delState, delAction] = useActionState(deleteGeoOverrideAction, idleState);
  const [hideState, hideAction] = useActionState(hideGeoEntryAction, idleState);
  const [level, setLevel] = useState<Level>("area");
  useToast(addState);
  useToast(delState);
  useToast(hideState);
  const districtName = (id: string | null) => districts.find((d) => d.id === id)?.en ?? divisions.find((d) => d.id === id)?.en ?? id ?? "—";

  return (
    <div className="space-y-5">
      <form action={addAction} className="space-y-3">
        <CsrfInput value={csrf} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField name="level" label="Add a" defaultValue={level} onChange={(e) => setLevel(e.target.value as Level)} options={[{ value: "area", label: "Area / neighbourhood" }, { value: "upazila", label: "Upazila / Thana" }, { value: "postcode", label: "Post office + postcode" }, { value: "district", label: "District" }]} />
          <SelectField name="parentId" label={level === "district" ? "Division" : "District"} defaultValue="" error={addState.fieldErrors?.parentId} options={[{ value: "", label: "Select…" }, ...(level === "district" ? divisions : districts).map((d) => ({ value: d.id, label: d.en }))]} />
          <TextField name="en" label="Name (English)" error={addState.fieldErrors?.en} required />
          <TextField name="bn" label="Name (Bangla)" />
          {level === "postcode" && <TextField name="code" label="Postcode" inputMode="numeric" maxLength={4} />}
          {level === "district" && (
            <>
              <TextField name="lat" label="Latitude" inputMode="decimal" />
              <TextField name="lng" label="Longitude" inputMode="decimal" />
            </>
          )}
        </div>
        <SubmitButton size="sm" pendingLabel="Adding…">
          <Plus className="h-3.5 w-3.5" /> Add
        </SubmitButton>
      </form>

      <form action={hideAction} className="border-t border-line pt-4">
        <CsrfInput value={csrf} />
        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Hide a bundled district you don&apos;t deliver to</p>
        <input type="hidden" name="level" value="district" />
        <div className="flex flex-wrap items-end gap-2">
          <select name="targetKey" className="field-box max-w-xs" defaultValue="">
            <option value="">Select district…</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.en}
              </option>
            ))}
          </select>
          <SubmitButton size="sm" pendingLabel="Hiding…">
            <EyeOff className="h-3.5 w-3.5" /> Hide
          </SubmitButton>
        </div>
      </form>

      <div className="border-t border-line pt-4">
        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">Your changes ({overrides.length})</p>
        {overrides.length === 0 ? (
          <p className="text-sm text-muted">Nothing added or hidden yet.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {overrides.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="mr-2 border border-line px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em] text-muted">{o.isHidden ? "hidden" : o.level}</span>
                  {o.isHidden ? districtName(o.targetKey) : o.en}
                  {o.bn && <span className="ml-1 text-muted">· {o.bn}</span>}
                  {o.code && <span className="ml-1 font-mono text-xs text-muted">{o.code}</span>}
                  {!o.isHidden && <span className="ml-1 text-xs text-muted">in {districtName(o.parentId)}</span>}
                </span>
                <form action={delAction}>
                  <CsrfInput value={csrf} />
                  <input type="hidden" name="id" value={o.id} />
                  <button type="submit" aria-label="Remove" className="p-1 text-muted hover:text-danger">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

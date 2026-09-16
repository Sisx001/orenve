"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, Copy, Download, Eye, Plus, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/admin/PageHeader";
import { CsrfInput } from "@/components/admin/Csrf";
import { FormBanner, SelectField, SubmitButton, TextField, ToggleRow } from "@/components/admin/Fields";
import { idleState, type ActionState } from "@/lib/admin/action-state";
import {
  applyThemeAction,
  createThemeFromPresetAction,
  deleteAssignmentAction,
  deleteThemeAction,
  importThemeAction,
  saveAssignmentAction,
  saveThemeModesAction,
  toggleAssignmentAction,
} from "@/lib/admin/actions/themes";
import { cn } from "@/lib/utils";

/* ─── colour helpers ─────────────────────────────────────────────── */

function tripletToHex(triplet: string): string {
  const parts = triplet.trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return "#000000";
  return "#" + parts.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("");
}

function Swatch({ triplet, size = 14 }: { triplet: string; size?: number }) {
  return (
    <span
      style={{ background: tripletToHex(triplet), width: size, height: size, display: "inline-block", borderRadius: 2, border: "1px solid rgba(0,0,0,.08)" }}
    />
  );
}

/* ─── Types ──────────────────────────────────────────────────────── */

type ThemeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  presetKey: string | null;
  swatches: string[];
  displayFont: string;
};

type PresetItem = {
  key: string;
  name: string;
  description: string;
  swatches: string[];
};

type AssignmentRow = {
  id: string;
  themeId: string;
  themeName: string;
  pathPattern: string;
  locale: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  isEnabled: boolean;
};

type ThemeModeSetting = {
  activeThemeId: string | null;
  modes: { light: boolean; dark: boolean; black: boolean };
  defaultMode: "light" | "dark" | "black" | "system";
  allowVisitorToggle: boolean;
};

type Props = {
  csrf: string;
  themeSetting: ThemeModeSetting;
  activeName: string;
  activeSwatches: string[];
  themes: ThemeRow[];
  presets: PresetItem[];
  assignments: AssignmentRow[];
  locales: { code: string; name: string }[];
};

/* ─── Active theme card ──────────────────────────────────────────── */

function ActiveCard({ name, swatches, csrf }: { name: string; swatches: string[]; csrf: string }) {
  const [state, action] = useActionState(applyThemeAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-oxide/30 bg-oxide/5 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-oxide">Active theme</p>
        <p className="mt-0.5 text-lg font-medium leading-snug">{name}</p>
        {swatches.length > 0 && (
          <div className="mt-2 flex gap-1">
            {swatches.map((s, i) => <Swatch key={i} triplet={s} size={16} />)}
          </div>
        )}
      </div>
      <form action={action} className="flex items-center gap-2">
        <CsrfInput value={csrf} />
        <input type="hidden" name="id" value="" />
        <button
          type="submit"
          className="btn-outline px-3 py-2 text-xs"
          title="Reset to built-in ORYNVE theme"
        >
          Reset to built-in
        </button>
      </form>
    </div>
  );
}

/* ─── Visitor modes form ─────────────────────────────────────────── */

function VisitorModesForm({ setting, csrf }: { setting: ThemeModeSetting; csrf: string }) {
  const [state, action] = useActionState(saveThemeModesAction, idleState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-1">
      <CsrfInput value={csrf} />
      <FormBanner state={state} />
      <ToggleRow name="light" label="Light mode" hint="The classic ORYNVE palette." defaultChecked={setting.modes.light} />
      <ToggleRow name="dark" label="Dark mode" hint="Inverted tones for low-light environments." defaultChecked={setting.modes.dark} />
      <ToggleRow name="black" label="Black mode" hint="True-black variant for OLED screens." defaultChecked={setting.modes.black} />
      <div className="pt-2">
        <SelectField
          name="defaultMode"
          label="Default mode"
          defaultValue={setting.defaultMode}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "black", label: "Black" },
            { value: "system", label: "Match visitor's device" },
          ]}
        />
      </div>
      <div className="pt-1">
        <ToggleRow
          name="allowVisitorToggle"
          label="Let visitors toggle colour mode"
          hint="Shows a mode switcher in the storefront header."
          defaultChecked={setting.allowVisitorToggle}
        />
      </div>
      <div className="pt-3">
        <SubmitButton size="sm" pendingLabel="Saving…">Save visitor modes</SubmitButton>
      </div>
    </form>
  );
}

/* ─── Preset card ────────────────────────────────────────────────── */

function PresetCard({ preset, csrf, onCustomise }: { preset: PresetItem; csrf: string; onCustomise: (key: string) => void }) {
  const [applyState, applyAction] = useActionState(applyThemeAction, idleState);
  const [customState, customAction] = useActionState(createThemeFromPresetAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (applyState.error) toast.error(applyState.error);
    else if (applyState.ok && applyState.message) toast.success(applyState.message);
  }, [applyState]);

  useEffect(() => {
    if (customState.error) toast.error(customState.error);
    else if (customState.ok && customState.data?.id) {
      toast.success(customState.message ?? "Created.");
      router.push(`/admin/settings/themes/${customState.data.id}`);
    }
  }, [customState, router]);

  return (
    <div className="card flex flex-col gap-3 p-4">
      {/* swatch strip */}
      <div className="flex gap-1.5">
        {preset.swatches.slice(0, 5).map((s, i) => (
          <span
            key={i}
            style={{ background: s, flex: 1, height: 36, borderRadius: 2, border: "1px solid rgba(0,0,0,.08)" }}
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{preset.name}</p>
        {preset.description && <p className="mt-0.5 text-xs text-muted line-clamp-2">{preset.description}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {/* Apply */}
        <form action={applyAction}>
          <CsrfInput value={csrf} />
          <input type="hidden" name="id" value={`preset:${preset.key}`} />
          <SubmitButton size="sm" pendingLabel="Applying…">Apply</SubmitButton>
        </form>
        {/* Preview */}
        <a
          href={`/en/?theme_preview=preset:${encodeURIComponent(preset.key)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex items-center gap-1 px-3 py-2 text-[0.65rem]"
        >
          <Eye className="h-3 w-3" />
          Preview
        </a>
        {/* Customise */}
        <form action={customAction}>
          <CsrfInput value={csrf} />
          <input type="hidden" name="presetKey" value={preset.key} />
          <SubmitButton size="sm" variant="outline" pendingLabel="Creating…">
            <Copy className="h-3 w-3" />
            Customise
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

/* ─── Custom theme row ───────────────────────────────────────────── */

function ThemeRow({ theme, csrf, isActive }: { theme: ThemeRow; csrf: string; isActive: boolean }) {
  const [applyState, applyAction] = useActionState(applyThemeAction, idleState);
  const [deleteState, deleteAction] = useActionState(deleteThemeAction, idleState);
  const [cloneState, cloneAction] = useActionState(createThemeFromPresetAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (applyState.error) toast.error(applyState.error);
    else if (applyState.ok && applyState.message) toast.success(applyState.message);
  }, [applyState]);

  useEffect(() => {
    if (deleteState.error) toast.error(deleteState.error);
    else if (deleteState.ok && deleteState.message) toast.success(deleteState.message);
  }, [deleteState]);

  useEffect(() => {
    if (cloneState.error) toast.error(cloneState.error);
    else if (cloneState.ok && cloneState.data?.id) {
      toast.success(cloneState.message ?? "Duplicated.");
      router.push(`/admin/settings/themes/${cloneState.data.id}`);
    }
  }, [cloneState, router]);

  return (
    <div className={cn("flex flex-wrap items-center gap-3 border-b border-line/60 py-3 last:border-0", isActive && "bg-oxide/5")}>
      <div className="flex items-center gap-1.5">
        {theme.swatches.map((s, i) => <Swatch key={i} triplet={s} />)}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{theme.name}</span>
        {theme.presetKey && <span className="ml-2 text-[0.62rem] text-muted">from {theme.presetKey}</span>}
        {isActive && <span className="ml-2 rounded bg-oxide/20 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-oxide">Active</span>}
        {theme.description && <p className="mt-0.5 text-xs text-muted line-clamp-1">{theme.description}</p>}
      </div>
      <div className="flex items-center gap-1">
        {/* Apply */}
        {!isActive && (
          <form action={applyAction}>
            <CsrfInput value={csrf} />
            <input type="hidden" name="id" value={theme.id} />
            <SubmitButton size="sm" pendingLabel="Applying…">Apply</SubmitButton>
          </form>
        )}
        {/* Preview */}
        <a
          href={`/en/?theme_preview=${encodeURIComponent(theme.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex h-7 w-7 items-center justify-center p-0 text-xs"
          title="Preview"
        >
          <Eye className="h-3.5 w-3.5" />
        </a>
        {/* Edit */}
        <Link
          href={`/admin/settings/themes/${theme.id}`}
          className="btn-outline inline-flex h-7 w-7 items-center justify-center p-0 text-xs"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        {/* Duplicate */}
        <form action={cloneAction}>
          <CsrfInput value={csrf} />
          <input type="hidden" name="presetKey" value={theme.presetKey ?? "__custom__"} />
          <input type="hidden" name="name" value={`${theme.name} (copy)`} />
          <button type="submit" className="btn-outline inline-flex h-7 w-7 items-center justify-center p-0 text-xs" title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </form>
        {/* Export */}
        <a
          href={`/api/admin/themes/${theme.id}/export`}
          className="btn-outline inline-flex h-7 w-7 items-center justify-center p-0 text-xs"
          title="Export JSON"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
        {/* Delete */}
        {!isActive && (
          <form action={deleteAction} onSubmit={(e) => { if (!confirm(`Delete "${theme.name}"? This cannot be undone.`)) e.preventDefault(); }}>
            <CsrfInput value={csrf} />
            <input type="hidden" name="id" value={theme.id} />
            <button type="submit" className="btn-outline inline-flex h-7 w-7 items-center justify-center p-0 text-xs text-danger hover:border-danger" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── Assignments table ──────────────────────────────────────────── */

function AssignmentsSection({
  assignments,
  themes,
  locales,
  csrf,
}: {
  assignments: AssignmentRow[];
  themes: ThemeRow[];
  locales: { code: string; name: string }[];
  csrf: string;
}) {
  const [saveState, saveAction] = useActionState(saveAssignmentAction, idleState);
  const [deleteState, deleteAction] = useActionState(deleteAssignmentAction, idleState);
  const [toggleState, toggleAction] = useActionState(toggleAssignmentAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (saveState.error) toast.error(saveState.error);
    else if (saveState.ok) {
      toast.success(saveState.message ?? "Saved.");
      formRef.current?.reset();
    }
  }, [saveState]);

  useEffect(() => {
    if (deleteState.error) toast.error(deleteState.error);
    else if (deleteState.ok && deleteState.message) toast.success(deleteState.message);
  }, [deleteState]);

  useEffect(() => {
    if (toggleState.error) toast.error(toggleState.error);
    else if (toggleState.ok && toggleState.message) toast.success(toggleState.message);
  }, [toggleState]);

  const commonPaths = ["/shop", "/collections/*", "/product/*", "/pages/*", "/lookbook", "/"];

  return (
    <Section
      title="Campaign assignments"
      description="Apply a theme to specific URL patterns or time windows. Higher priority wins when multiple rules match."
    >
      {/* Add form */}
      <form ref={formRef} action={saveAction} className="mb-5 grid gap-3 rounded border border-line/60 p-4 sm:grid-cols-2">
        <CsrfInput value={csrf} />
        <p className="col-span-full text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Add assignment</p>
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Theme</label>
          <select name="themeId" required className="field-box pr-8">
            <option value="">Select a theme…</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Path pattern</label>
          <input
            name="pathPattern"
            defaultValue="*"
            className="field-box"
            list="path-suggestions"
            placeholder="* or /shop or /collections/*"
          />
          <datalist id="path-suggestions">
            {commonPaths.map((p) => <option key={p} value={p} />)}
          </datalist>
          <p className="mt-1 text-xs text-muted">* = all pages. Use /* for wildcard paths.</p>
        </div>
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Locale (optional)</label>
          <select name="locale" className="field-box pr-8">
            <option value="">All languages</option>
            {locales.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Priority</label>
          <input name="priority" type="number" defaultValue={0} min={-100} max={100} className="field-box" />
        </div>
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Starts at</label>
          <input name="startsAt" type="datetime-local" className="field-box" />
        </div>
        <div>
          <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">Ends at</label>
          <input name="endsAt" type="datetime-local" className="field-box" />
        </div>
        <div className="col-span-full flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isEnabled" value="on" defaultChecked className="h-4 w-4 accent-[rgb(var(--c-oxide))]" />
            Enabled immediately
          </label>
          <SubmitButton size="sm" pendingLabel="Adding…">
            <Plus className="h-3.5 w-3.5" />
            Add assignment
          </SubmitButton>
        </div>
        <FormBanner state={saveState} />
      </form>

      {/* Table */}
      {assignments.length === 0 ? (
        <p className="text-sm text-muted">No assignments yet. Add one above to apply a theme to a specific page or campaign.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
                <th className="pb-2 pr-4">Theme</th>
                <th className="pb-2 pr-4">Path</th>
                <th className="pb-2 pr-4">Locale</th>
                <th className="pb-2 pr-4">Schedule</th>
                <th className="pb-2 pr-4">Priority</th>
                <th className="pb-2 pr-4">Enabled</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className={cn("border-b border-line/60 last:border-0", !a.isEnabled && "opacity-50")}>
                  <td className="py-2 pr-4 font-medium">{a.themeName}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{a.pathPattern}</td>
                  <td className="py-2 pr-4 text-xs text-muted">{a.locale ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-muted">
                    {a.startsAt || a.endsAt
                      ? `${a.startsAt ? new Date(a.startsAt).toLocaleDateString() : "∞"} → ${a.endsAt ? new Date(a.endsAt).toLocaleDateString() : "∞"}`
                      : "Always"}
                  </td>
                  <td className="py-2 pr-4 text-xs tabular-nums">{a.priority}</td>
                  <td className="py-2 pr-4">
                    <form action={toggleAction}>
                      <CsrfInput value={csrf} />
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="isEnabled" value={a.isEnabled ? "" : "on"} />
                      <button type="submit" className="text-muted hover:text-oxide" title={a.isEnabled ? "Disable" : "Enable"}>
                        <ToggleLeft className={cn("h-4 w-4", a.isEnabled && "text-oxide")} />
                      </button>
                    </form>
                  </td>
                  <td className="py-2">
                    <form action={deleteAction} onSubmit={(e) => { if (!confirm("Remove this assignment?")) e.preventDefault(); }}>
                      <CsrfInput value={csrf} />
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-muted hover:text-danger" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ─── Import form ────────────────────────────────────────────────── */

function ImportForm({ csrf }: { csrf: string }) {
  const [state, action] = useActionState(importThemeAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok && state.data?.id) {
      toast.success(state.message ?? "Imported.");
      router.push(`/admin/settings/themes/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <CsrfInput value={csrf} />
      <FormBanner state={state} />
      <div>
        <label className="mb-1 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">JSON file</label>
        <input type="file" name="file" accept=".json,application/json" required className="field-box" />
      </div>
      <SubmitButton size="sm" pendingLabel="Importing…">Import theme</SubmitButton>
    </form>
  );
}

/* ─── Main client component ──────────────────────────────────────── */

export function ThemesOverviewClient({
  csrf,
  themeSetting,
  activeName,
  activeSwatches,
  themes,
  presets,
  assignments,
  locales,
}: Props) {
  const activeId = themeSetting.activeThemeId;

  return (
    <div className="space-y-6">
      {/* Active theme */}
      <Section title="Active theme">
        <ActiveCard name={activeName} swatches={activeSwatches} csrf={csrf} />
        <p className="mt-3 text-xs text-muted">
          Apply a preset or custom theme below, or use the built-in ORYNVE palette derived from Brand settings.
        </p>
      </Section>

      {/* Visitor modes */}
      <Section title="Visitor colour modes" description="Which colour modes visitors can use on the storefront.">
        <VisitorModesForm setting={themeSetting} csrf={csrf} />
      </Section>

      {/* Presets gallery */}
      <Section
        title="Preset gallery"
        description={presets.length === 0 ? "Presets load from the Prism integration — they will appear here once integrated." : `${presets.length} built-in presets. Apply directly or customise into an editable copy.`}
      >
        {presets.length === 0 ? (
          <p className="text-sm text-muted">No presets available yet. The Prism module (src/lib/theme/presets.ts) must be integrated first.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {presets.map((p) => (
              <PresetCard key={p.key} preset={p} csrf={csrf} onCustomise={() => {}} />
            ))}
          </div>
        )}
      </Section>

      {/* Custom themes */}
      <Section
        title="Your themes"
        description="Custom themes created from presets or imported."
        actions={
          <Link href="/admin/settings/themes/new" className="btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-[0.65rem]">
            <Plus className="h-3.5 w-3.5" />
            New theme
          </Link>
        }
      >
        {themes.length === 0 ? (
          <p className="text-sm text-muted">No custom themes yet. Customise a preset above or import a JSON file below.</p>
        ) : (
          <div>
            {themes.map((t) => (
              <ThemeRow key={t.id} theme={t} csrf={csrf} isActive={activeId === t.id} />
            ))}
          </div>
        )}
      </Section>

      {/* Assignments */}
      <AssignmentsSection assignments={assignments} themes={themes} locales={locales} csrf={csrf} />

      {/* Import */}
      <Section title="Import" description="Upload a theme JSON previously exported from ORYNVE. A new editable theme is created — nothing is overwritten.">
        <ImportForm csrf={csrf} />
      </Section>
    </div>
  );
}

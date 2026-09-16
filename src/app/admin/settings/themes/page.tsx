import { Suspense } from "react";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { getEnabledLocales } from "@/lib/i18n/registry";
import { parseJson } from "@/lib/json";
import {
  BASE_LIGHT,
  DEFAULT_TYPOGRAPHY,
  type ThemeDefinition,
  type TokenMap,
  type ThemeTypography,
} from "@/lib/theme/types";
import { ThemesOverviewClient } from "./ThemesOverviewClient";

export const dynamic = "force-dynamic";

export default async function ThemesPage() {
  await requireStudio("themes.write", "/admin/settings/themes");

  const [themeSetting, csrf, locales, themes, assignments] = await Promise.all([
    getSetting("theme"),
    csrfToken(),
    getEnabledLocales(),
    db.theme.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, slug: true, name: true, description: true, presetKey: true, light: true, typography: true, createdAt: true, updatedAt: true } }),
    db.themeAssignment.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: { theme: { select: { id: true, name: true } } },
    }),
  ]);

  // Resolve active theme name
  let activeName = "Built-in ORYNVE";
  let activeSwatches: string[] = [];
  if (themeSetting.activeThemeId) {
    if (themeSetting.activeThemeId.startsWith("preset:")) {
      activeName = `Preset: ${themeSetting.activeThemeId.slice(7)}`;
    } else {
      const found = themes.find((t) => t.id === themeSetting.activeThemeId);
      if (found) {
        activeName = found.name;
        const light = parseJson<TokenMap>(found.light, BASE_LIGHT);
        activeSwatches = ["ink", "paper", "bone", "oxide", "brass"].map((k) => light[k as keyof TokenMap] ?? "0 0 0");
      }
    }
  }

  // Map themes for client
  const themeRows = themes.map((t) => {
    const light = parseJson<TokenMap>(t.light, BASE_LIGHT);
    const typo = parseJson<ThemeTypography>(t.typography, DEFAULT_TYPOGRAPHY);
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description ?? "",
      presetKey: t.presetKey ?? null,
      swatches: (["ink", "paper", "bone", "oxide", "brass"] as const).map((k) => light[k] ?? "0 0 0"),
      displayFont: typo.display,
    };
  });

  // Map assignments for client
  const assignmentRows = assignments.map((a) => ({
    id: a.id,
    themeId: a.themeId,
    themeName: a.theme.name,
    pathPattern: a.pathPattern,
    locale: a.locale ?? null,
    startsAt: a.startsAt?.toISOString() ?? null,
    endsAt: a.endsAt?.toISOString() ?? null,
    priority: a.priority,
    isEnabled: a.isEnabled,
  }));

  // Preset list — lazy: if Prism's module isn't integrated yet, show empty.
  let presetList: { key: string; name: string; description: string; swatches: string[] }[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("@/lib/theme/presets") as {
      PRESET_LIST: { key: string; name: string; description: string; swatches: string[] }[];
    };
    presetList = m.PRESET_LIST;
  } catch {
    // Prism's module not yet integrated — gallery will be empty.
  }

  const localeCodes = locales.map((l) => ({ code: l.code, name: l.name }));

  return (
    <div>
      <PageHeader
        title="Themes"
        description="Control the visual identity of the storefront — colours, typography, layout, and which modes visitors can use."
      />
      <Suspense>
        <ThemesOverviewClient
          csrf={csrf}
          themeSetting={themeSetting}
          activeName={activeName}
          activeSwatches={activeSwatches}
          themes={themeRows}
          presets={presetList}
          assignments={assignmentRows}
          locales={localeCodes}
        />
      </Suspense>
    </div>
  );
}

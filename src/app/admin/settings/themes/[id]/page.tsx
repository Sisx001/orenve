import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/json";
import {
  BASE_LIGHT,
  BASE_DARK,
  BASE_BLACK,
  DEFAULT_LAYOUT,
  DEFAULT_TYPOGRAPHY,
  type ThemeDefinition,
  type TokenMap,
  type ThemeLayout,
  type ThemeTypography,
} from "@/lib/theme/types";
import { ThemeEditor } from "./ThemeEditor";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ThemeEditorPage({ params }: PageProps) {
  await requireStudio("themes.write", "/admin/settings/themes");
  const { id } = await params;

  // "new" → blank theme
  if (id === "new") {
    const csrf = await csrfToken();
    const blank: ThemeDefinition = {
      key: "",
      name: "New Theme",
      description: "",
      light: { ...BASE_LIGHT },
      dark: { ...BASE_DARK },
      black: { ...BASE_BLACK },
      typography: { ...DEFAULT_TYPOGRAPHY, customFonts: [] },
      layout: { ...DEFAULT_LAYOUT },
      customCss: "",
    };
    return (
      <div>
        <PageHeader title="New theme" description="Design a custom theme from scratch." />
        <ThemeEditor initialDefinition={blank} csrf={csrf} themeId={null} />
      </div>
    );
  }

  const row = await db.theme.findUnique({ where: { id } });
  if (!row) notFound();

  const definition: ThemeDefinition = {
    key: row.id,
    name: row.name,
    description: row.description ?? "",
    light: parseJson<TokenMap>(row.light, BASE_LIGHT),
    dark: parseJson<TokenMap>(row.dark, BASE_DARK),
    black: parseJson<TokenMap>(row.black, BASE_BLACK),
    typography: parseJson<ThemeTypography>(row.typography, DEFAULT_TYPOGRAPHY),
    layout: parseJson<ThemeLayout>(row.layout, DEFAULT_LAYOUT),
    customCss: row.customCss ?? "",
  };

  const csrf = await csrfToken();

  return (
    <div>
      <PageHeader
        title={row.name}
        description={row.description ?? "Edit colours, typography, layout and custom CSS."}
      />
      <ThemeEditor initialDefinition={definition} csrf={csrf} themeId={row.id} />
    </div>
  );
}

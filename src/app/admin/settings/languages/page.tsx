import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { requireStudio } from "@/lib/admin/session";
import { csrfToken } from "@/lib/admin/csrf";
import { getSetting } from "@/lib/settings";
import { getLocales } from "@/lib/i18n/registry";
import { coverageMany, CONTENT_MODEL_LABELS, isContentModel, CONTENT_MODELS, type ContentModel, type Coverage } from "@/lib/i18n/translate";
import { getAiConnection } from "@/lib/ai/concierge";
import { LanguagesManager, type LanguageRow } from "./LanguagesManager";
import { AddLanguageForm } from "./AddLanguageForm";
import { EngineSettingsForm } from "./EngineSettingsForm";

export const dynamic = "force-dynamic";

export default async function LanguagesSettingsPage() {
  await requireStudio("i18n.write", "/admin/settings/languages");

  const [locales, settings, csrf, conn] = await Promise.all([getLocales(), getSetting("i18n"), csrfToken(), getAiConnection()]);
  const coverage: Record<string, Coverage> = await coverageMany(locales.map((l) => l.code)).catch(() => ({}));

  const rows: LanguageRow[] = locales.map((l) => ({
    ...l,
    coverage: coverage[l.code] ?? null,
  }));

  const models: ContentModel[] = settings.contentModels.filter(isContentModel);
  const contentModels = (models.length ? models : [...CONTENT_MODELS]).map((m) => ({ value: m, label: CONTENT_MODEL_LABELS[m] }));

  const extra = rows.filter((l) => !l.builtIn).length;

  return (
    <div>
      <PageHeader
        title="Languages & translation"
        description="English is the source of truth. Add any language, let the AI engine write the interface dictionary and the catalogue, then review it before switching it on."
      />

      {!conn && (
        <div className="mb-5 flex flex-wrap items-center gap-3 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <span>The AI translation engine needs a model connection before it can generate anything.</span>
          <Link href="/admin/settings/ai" className="font-semibold underline underline-offset-4">
            Configure AI
          </Link>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Section
            title={`Languages (${rows.length})`}
            description={extra ? `${extra} added from the studio. Disabled languages are not reachable on the storefront.` : "Only the built-in languages so far. Add one on the right."}
          >
            <LanguagesManager rows={rows} csrf={csrf} aiConfigured={Boolean(conn)} contentModels={contentModels} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Add a language" description="Pick one of the curated presets, or type any BCP-47 primary subtag.">
            <AddLanguageForm csrf={csrf} existing={rows.map((r) => r.code)} />
          </Section>

          <Section title="Translation engine" description="How the AI writes translations, and what it must never touch.">
            <EngineSettingsForm
              csrf={csrf}
              values={{
                glossary: settings.glossary.join(", "),
                autoTranslateNewContent: settings.autoTranslateNewContent,
                showMachineBadge: settings.showMachineBadge,
                batchSize: settings.batchSize,
              }}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

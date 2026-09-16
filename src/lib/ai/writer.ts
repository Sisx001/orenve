import "server-only";
import { chatCompletion, type AiConnection } from "./client";

/* ───────────────────────── locale name map ───────────────────────── */

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  bn: "Bengali (Bangla)",
  hi: "Hindi",
  ar: "Arabic",
  ur: "Urdu",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  tr: "Turkish",
  id: "Indonesian",
  ms: "Malay",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
};

export function resolveLocaleName(code: string): string {
  return LOCALE_NAMES[code] ?? code;
}

/* ───────────────────────── main export ───────────────────────── */

export type WriteCopyOpts = {
  task: string;
  mode: "write" | "improve" | "translate";
  locale: string;
  localeName: string;
  text?: string;
  sourceText?: string;
  context?: Record<string, string | number>;
  glossary?: string[];
  brandVoice?: string;
  brandName?: string;
  temperature?: number;
  maxWords?: number;
  conn: AiConnection;
};

/**
 * Generate or improve copy for a given task and locale.
 * Server-only — import only from route handlers or server actions.
 */
export async function writeCopy(opts: WriteCopyOpts): Promise<string> {
  const {
    task,
    mode,
    locale,
    localeName,
    text,
    sourceText,
    context,
    glossary,
    brandVoice,
    brandName,
    temperature,
    maxWords,
    conn,
  } = opts;

  /* ── system prompt ── */
  const systemLines: string[] = [
    `You are a professional copywriter for ${brandName ?? "ORYNVE"}, a premium menswear brand.`,
    `Brand voice: ${brandVoice ?? "Quiet confidence. Precise, warm, unhurried. Short sentences. No hype words, no exclamation marks, no emojis. British spelling in English; natural, modern Bangla — never a word-for-word transliteration."}`,
  ];

  if (glossary && glossary.length > 0) {
    systemLines.push(
      `Keep these terms verbatim — never translate or modify them: ${glossary.join(", ")}.`,
    );
  }

  systemLines.push(
    `Keep placeholders like {items}, {name}, {code}, {count} intact exactly as written.`,
  );
  systemLines.push(
    `Output plain text only — no code fences, no surrounding quotes, no markdown unless the task requires it.`,
  );

  if (locale !== "en") {
    systemLines.push(
      `Write natively in ${localeName}. Do NOT transliterate from English — use natural, fluent ${localeName}.`,
    );
    if (locale === "bn") {
      systemLines.push(
        `Use natural modern Bangla throughout. Bengali script only.`,
      );
    }
    if (locale === "ar" || locale === "ur") {
      systemLines.push(`Write right-to-left. Use Arabic script.`);
    }
  }

  const system = systemLines.join("\n");

  /* ── task description ── */
  const taskDesc = getTaskDescription(task, maxWords);

  /* ── user message ── */
  let userMsg: string;

  if (mode === "translate") {
    const src = (sourceText ?? "").trim();
    if (!src) {
      return "";
    }
    userMsg = `Translate the following English copy into ${localeName}.\nTask context: ${taskDesc}\n\nEnglish source:\n${src}`;
  } else if (mode === "improve") {
    const existing = (text ?? "").trim();
    userMsg = `Improve and rewrite the following copy in the brand voice.\nTask context: ${taskDesc}`;
    if (existing) userMsg += `\n\nExisting copy:\n${existing}`;
    if (context) {
      const ctxStr = formatContext(context);
      if (ctxStr) userMsg += `\n\nProduct/page context:\n${ctxStr}`;
    }
  } else {
    // write
    userMsg = `Write copy for: ${taskDesc}`;
    if (context) {
      const ctxStr = formatContext(context);
      if (ctxStr) userMsg += `\n\nContext:\n${ctxStr}`;
    }
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ];

  const maxTok = getMaxTokens(task);
  let output = sanitize(
    (
      await chatCompletion(conn, messages, {
        temperature: temperature ?? 0.7,
        maxTokens: maxTok,
      })
    ).message.content ?? "",
  );

  /* ── enforce word limit ── */
  if (maxWords) {
    const wordCount = output.split(/\s+/).filter(Boolean).length;
    if (wordCount > maxWords * 1.2) {
      const trimmed = sanitize(
        (
          await chatCompletion(
            conn,
            [
              ...messages,
              { role: "assistant" as const, content: output },
              {
                role: "user" as const,
                content: `That is too long (${wordCount} words). Please rewrite it in at most ${maxWords} words, keeping the same style and key facts.`,
              },
            ],
            { temperature: temperature ?? 0.7, maxTokens: maxTok },
          )
        ).message.content ?? output,
      );
      if (trimmed) output = trimmed;
    }
  }

  /* ── enforce hard character limits ── */
  if (task === "seo_title" && output.length > 65) {
    output = await shorten(conn, messages, output, `${output.length} characters — must be 60 characters or fewer.`, 80, temperature);
  }
  if (task === "seo_description" && output.length > 160) {
    output = await shorten(conn, messages, output, `${output.length} characters — must be 155 characters or fewer.`, 200, temperature);
  }
  if (task === "announcement" && output.length > 100) {
    output = await shorten(conn, messages, output, `${output.length} characters — must be 90 characters or fewer.`, 120, temperature);
  }

  return output;
}

/* ───────────────────────── helpers ───────────────────────── */

async function shorten(
  conn: AiConnection,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  current: string,
  complaint: string,
  maxTok: number,
  temperature?: number,
): Promise<string> {
  const result = sanitize(
    (
      await chatCompletion(
        conn,
        [
          ...messages,
          { role: "assistant" as const, content: current },
          {
            role: "user" as const,
            content: `That is ${complaint} Rewrite it shorter.`,
          },
        ],
        { temperature: temperature ?? 0.7, maxTokens: maxTok },
      )
    ).message.content ?? current,
  );
  return result || current;
}

function sanitize(raw: string): string {
  return raw
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```$/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function formatContext(ctx: Record<string, string | number>): string {
  return Object.entries(ctx)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function getTaskDescription(task: string, maxWords?: number): string {
  const wordHint = maxWords ? ` (aim for ${maxWords} words or fewer)` : "";
  switch (task) {
    case "product_description":
      return `Product description${wordHint}. Lead with how the garment feels and how it is worn. Two short, assured paragraphs — no bullet points, no feature dumps. Weave in any material, fit, or care facts from the context naturally. Never invent measurements, prices, or specs not provided.`;
    case "size_notes":
      return `Size and fit notes${wordHint}. Practical guidance: how the cut runs, whether to size up or down, and what build it suits best. One short paragraph or two to three short lines.`;
    case "seo_title":
      return `SEO page title — 60 characters or fewer. Lead with the product or page name; include the brand name (ORYNVE) at the end after an em dash. No punctuation at the very end.`;
    case "seo_description":
      return `SEO meta description — 155 characters or fewer. Summarise the page compellingly for search results. Include one clear benefit. End with a soft call to action.`;
    case "banner":
      return `Hero banner headline${wordHint}. Short, atmospheric, brand-aligned. Evoke texture, craft, or occasion. No punctuation at the end unless it is a question.`;
    case "announcement":
      return `Announcement bar message — 90 characters or fewer. Informative and enticing. Use any {placeholders} from the context verbatim if provided.`;
    case "email":
      return `Email copy${wordHint}. Warm, direct, on-brand. One clear point per paragraph. End with a single call to action.`;
    case "page":
      return `Page body content${wordHint}. Clear, structured, on-brand. Use markdown for headings and formatting where helpful.`;
    case "tagline":
      return `Brand tagline${wordHint}. Memorable, concise, no clichés. Evokes the brand character in a single thought.`;
    default:
      return `Copy${wordHint}. On-brand, precise, concise.`;
  }
}

function getMaxTokens(task: string): number {
  switch (task) {
    case "product_description":
      return 600;
    case "size_notes":
      return 200;
    case "seo_title":
      return 80;
    case "seo_description":
      return 200;
    case "announcement":
      return 100;
    case "banner":
      return 80;
    case "tagline":
      return 60;
    case "email":
      return 800;
    case "page":
      return 1200;
    default:
      return 400;
  }
}

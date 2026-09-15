"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSetting, saveSetting } from "@/lib/settings";
import { SUPPORTED_LOCALES } from "@/lib/constants";
import { authorize, fail, revalidateStudio, runAction, succeed, type ActionState } from "@/lib/admin/guard";
import { readBool, readI18n, readInt, readJson, readMoney } from "@/lib/admin/schemas";

const pairOf = (fd: FormData, base: string) => {
  const p = readI18n(fd, base);
  return { en: p.en, bn: p.bn };
};
const num = (fd: FormData, name: string, fallback: number) => {
  const raw = String(fd.get(name) ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

/* ───────────────────────────── brand & theme ───────────────────────────── */

export async function saveBrandAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    const logo = String(fd.get("logoUrl") ?? "").trim();
    const value = await saveSetting("brand", {
      name: String(fd.get("name") ?? "ORYNVE").trim() || "ORYNVE",
      tagline: pairOf(fd, "tagline"),
      logoUrl: logo || null,
      accent: String(fd.get("accent") ?? "#c2542b"),
      brass: String(fd.get("brass") ?? "#c9a25c"),
      theme: String(fd.get("theme") ?? "light"),
      radius: num(fd, "radius", 2),
      fontDisplay: String(fd.get("fontDisplay") ?? "Fraunces"),
      fontSans: String(fd.get("fontSans") ?? "Space Grotesk"),
      fontBangla: String(fd.get("fontBangla") ?? "Hind Siliguri"),
      announcement: pairOf(fd, "announcement"),
      announcementLink: String(fd.get("announcementLink") ?? "/shop"),
      showAnnouncement: readBool(fd, "showAnnouncement"),
    });
    await audit(user.id, "settings.brand", "setting", "brand", { name: value.name, theme: value.theme });
    revalidateStudio("/admin/settings/brand");
    return succeed("Brand and theme saved. The storefront picks this up immediately.");
  });
}

/* ───────────────────────────── contact ───────────────────────────── */

export async function saveContactAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    await saveSetting("contact", {
      whatsapp: String(fd.get("whatsapp") ?? "").replace(/\D/g, ""),
      messengerPage: String(fd.get("messengerPage") ?? "").trim(),
      instagram: String(fd.get("instagram") ?? "").trim(),
      facebook: String(fd.get("facebook") ?? "").trim(),
      tiktok: String(fd.get("tiktok") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      address: pairOf(fd, "address"),
      hours: pairOf(fd, "hours"),
      mapUrl: String(fd.get("mapUrl") ?? "").trim(),
    });
    await audit(user.id, "settings.contact", "setting", "contact");
    revalidateStudio("/admin/settings/contact", "/admin");
    return succeed("Contact channels saved.");
  });
}

/* ───────────────────────────── features ───────────────────────────── */

export async function saveFeaturesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    const current = await getSetting("features");
    const next: Record<string, boolean> = {};
    for (const key of Object.keys(current)) next[key] = readBool(fd, key);
    await saveSetting("features", next);
    await audit(user.id, "settings.features", "setting", "features", { on: Object.values(next).filter(Boolean).length });
    revalidateStudio("/admin/settings/features");
    return succeed("Features saved.");
  });
}

/* ───────────────────────────── checkout & payments ───────────────────────────── */

export async function saveCheckoutAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    await saveSetting("checkout", {
      whatsapp: readBool(fd, "whatsapp"),
      messenger: readBool(fd, "messenger"),
      website: readBool(fd, "website"),
      cod: readBool(fd, "cod"),
      bkash: readBool(fd, "bkash"),
      nagad: readBool(fd, "nagad"),
      sslcommerz: readBool(fd, "sslcommerz"),
      stripe: readBool(fd, "stripe"),
      bkashNumber: String(fd.get("bkashNumber") ?? "").trim(),
      nagadNumber: String(fd.get("nagadNumber") ?? "").trim(),
      mfsInstructions: pairOf(fd, "mfsInstructions"),
      requireEmail: readBool(fd, "requireEmail"),
      guestCheckout: readBool(fd, "guestCheckout"),
      minOrder: readMoney(fd, "minOrder") ?? 0,
      notesEnabled: readBool(fd, "notesEnabled"),
      whatsappTemplate: pairOf(fd, "whatsappTemplate"),
      autoConfirmCod: readBool(fd, "autoConfirmCod"),
    });
    await audit(user.id, "settings.checkout", "setting", "checkout");
    revalidateStudio("/admin/settings/checkout", "/admin");
    return succeed("Checkout and payment settings saved.");
  });
}

/* ───────────────────────────── currency & locale ───────────────────────────── */

export async function saveCurrencyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    const rows = readJson<{ code: string; symbol: string; rate: number; decimals: number; enabled: boolean }[]>(fd, "display", []);

    const cleaned = rows
      .filter((r) => /^[A-Za-z]{3}$/.test(String(r.code ?? "")))
      .map((r) => ({
        code: String(r.code).toUpperCase(),
        symbol: String(r.symbol ?? "").slice(0, 4) || String(r.code).toUpperCase(),
        rate: r.code.toUpperCase() === "BDT" ? 1 : Math.max(0.000001, Number(r.rate) || 1),
        decimals: Math.min(2, Math.max(0, Math.round(Number(r.decimals) || 0))),
        enabled: Boolean(r.enabled),
      }));

    if (!cleaned.some((c) => c.code === "BDT")) cleaned.unshift({ code: "BDT", symbol: "৳", rate: 1, decimals: 0, enabled: true });
    const seen = new Set<string>();
    const display = cleaned.filter((c) => (seen.has(c.code) ? false : (seen.add(c.code), true)));

    await saveSetting("currency", { base: "BDT", display });

    const enabled = fd.getAll("locales").map(String).filter((l) => (SUPPORTED_LOCALES as readonly string[]).includes(l));
    const def = String(fd.get("defaultLocale") ?? "en");
    await saveSetting("locale", {
      default: enabled.includes(def) ? def : (enabled[0] ?? "en"),
      enabled: enabled.length ? enabled : ["en"],
      autoDetect: readBool(fd, "autoDetect"),
    });

    await audit(user.id, "settings.currency", "setting", "currency", { currencies: display.length, locales: enabled.join(",") });
    revalidateStudio("/admin/settings/currency");
    return succeed("Currencies and locales saved.");
  });
}

/* ───────────────────────────── SEO ───────────────────────────── */

export async function saveSeoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    await saveSetting("seo", {
      title: pairOf(fd, "title"),
      description: pairOf(fd, "description"),
      ogImage: String(fd.get("ogImage") ?? "").trim(),
      twitter: String(fd.get("twitter") ?? "").trim(),
      gaId: String(fd.get("gaId") ?? "").trim(),
      metaPixelId: String(fd.get("metaPixelId") ?? "").trim(),
      robotsIndex: readBool(fd, "robotsIndex"),
    });
    await audit(user.id, "settings.seo", "setting", "seo");
    revalidateStudio("/admin/settings/seo");
    return succeed("SEO settings saved.");
  });
}

/* ───────────────────────────── site mode ───────────────────────────── */

export async function saveSiteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    const allowlist = String(fd.get("allowlistIps") ?? "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    const value = await saveSetting("site", {
      mode: String(fd.get("mode") ?? "live"),
      maintenanceTitle: pairOf(fd, "maintenanceTitle"),
      maintenanceMessage: pairOf(fd, "maintenanceMessage"),
      launchDate: String(fd.get("launchDate") ?? "").trim(),
      maintenanceImage: String(fd.get("maintenanceImage") ?? "").trim(),
      allowlistIps: allowlist,
    });
    await audit(user.id, "settings.site", "setting", "site", { mode: value.mode });
    revalidateStudio("/admin/settings/site");
    return succeed(value.mode === "live" ? "The storefront is live." : `Site mode set to ${value.mode.replace("_", " ")}.`);
  });
}

/* ───────────────────────────── AI concierge ───────────────────────────── */

export async function saveAiAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("ai.configure", fd);
    const current = await getSetting("ai");
    const submittedKey = String(fd.get("apiKey") ?? "");
    // An empty field means "leave the stored key alone".
    const apiKey = submittedKey.trim() === "" ? current.apiKey : submittedKey.trim();

    await saveSetting("ai", {
      enabled: readBool(fd, "enabled"),
      provider: "openai_compatible",
      baseUrl: String(fd.get("baseUrl") ?? "").trim(),
      apiKey,
      model: String(fd.get("model") ?? "").trim(),
      temperature: Math.min(1, Math.max(0, num(fd, "temperature", 0.2))),
      maxTokens: Math.min(4096, Math.max(64, readInt(fd, "maxTokens", 600))),
      assistantName: pairOf(fd, "assistantName"),
      greeting: pairOf(fd, "greeting"),
      extraInstructions: String(fd.get("extraInstructions") ?? "").slice(0, 8000),
      allowProductSearch: readBool(fd, "allowProductSearch"),
      allowOrderLookup: readBool(fd, "allowOrderLookup"),
      requirePhoneForOrder: readBool(fd, "requirePhoneForOrder"),
      maxMessagesPerSession: Math.max(1, readInt(fd, "maxMessagesPerSession", 40)),
      rateLimitPerHour: Math.max(1, readInt(fd, "rateLimitPerHour", 60)),
      logConversations: readBool(fd, "logConversations"),
      handoffWhatsapp: readBool(fd, "handoffWhatsapp"),
    });

    await audit(user.id, "settings.ai", "setting", "ai", { model: String(fd.get("model") ?? ""), keyChanged: submittedKey.trim() !== "" });
    revalidateStudio("/admin/settings/ai", "/admin");
    return succeed("Concierge settings saved.");
  });
}

export async function clearAiKeyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("ai.configure", fd);
    const current = await getSetting("ai");
    await saveSetting("ai", { ...current, apiKey: "" });
    await audit(user.id, "settings.ai_key_clear", "setting", "ai");
    revalidateStudio("/admin/settings/ai");
    return succeed("Stored API key removed. The env AI_API_KEY (if set) will be used instead.");
  });
}

/* ───────────────────────────── translations ───────────────────────────── */

export async function saveTranslationsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("settings.write", fd);
    const rows = readJson<{ locale: string; key: string; value: string }[]>(fd, "overrides", []);
    if (rows.length === 0) return fail("Nothing to save.");

    let saved = 0;
    let cleared = 0;
    for (const row of rows.slice(0, 500)) {
      const locale = String(row.locale ?? "").slice(0, 5);
      const fullKey = String(row.key ?? "");
      if (!locale || !fullKey) continue;
      const dot = fullKey.indexOf(".");
      const namespace = dot > 0 ? fullKey.slice(0, dot) : "common";
      const key = dot > 0 ? fullKey.slice(dot + 1) : fullKey;
      const value = String(row.value ?? "");

      if (value.trim() === "") {
        const res = await db.translation.deleteMany({ where: { locale, namespace, key } });
        cleared += res.count;
      } else {
        await db.translation.upsert({
          where: { locale_namespace_key: { locale, namespace, key } },
          update: { value },
          create: { locale, namespace, key, value },
        });
        saved++;
      }
    }

    await audit(user.id, "settings.translations", "setting", "translations", { saved, cleared });
    revalidateStudio("/admin/settings/translations");
    return succeed(`${saved} override${saved === 1 ? "" : "s"} saved${cleared ? `, ${cleared} reset` : ""}.`);
  });
}

/* ───────────────────────────── concierge conversations ───────────────────────────── */

export async function deleteConversationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("ai.configure", fd);
    const id = String(fd.get("conversationId") ?? "");
    if (id === "all-flagged") {
      const res = await db.aiConversation.deleteMany({ where: { flagged: true } });
      await audit(user.id, "ai.conversations_purge", "aiConversation", null, { count: res.count });
      revalidateStudio("/admin/concierge");
      return succeed(`${res.count} flagged conversation${res.count === 1 ? "" : "s"} deleted.`);
    }
    if (!(await db.aiConversation.findUnique({ where: { id }, select: { id: true } }))) return fail("That conversation no longer exists.");
    await db.aiConversation.delete({ where: { id } });
    await audit(user.id, "ai.conversation_delete", "aiConversation", id);
    revalidateStudio("/admin/concierge");
    return succeed("Conversation deleted.");
  });
}

export async function unflagConversationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await authorize("ai.configure", fd);
    const id = String(fd.get("conversationId") ?? "");
    await db.aiConversation.update({ where: { id }, data: { flagged: false, flagReason: null } });
    await audit(user.id, "ai.conversation_unflag", "aiConversation", id);
    revalidateStudio("/admin/concierge");
    return succeed("Flag cleared.");
  });
}

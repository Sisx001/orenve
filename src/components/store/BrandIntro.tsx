"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useT, useLocale } from "@/lib/i18n/client";
import { useConfig } from "@/components/providers/ConfigProvider";
import { i18nText } from "@/lib/json";
import { Wordmark } from "@/components/brand/Logo";
import { EASE } from "@/lib/store/motion";

const KEY = "orynve.intro.seen";

/**
 * First-visit curtain. Shown once per session, skippable, and skipped outright
 * for visitors who prefer reduced motion or when the owner disables it.
 */
export function BrandIntro() {
  const t = useT();
  const locale = useLocale();
  const { config } = useConfig();
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!config.features.intro || reduced) return;
    let seen = "1";
    try {
      seen = sessionStorage.getItem(KEY) ?? "0";
    } catch {
      return;
    }
    if (seen === "1") return;
    setShow(true);
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => close(), 2600);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.features.intro, reduced]);

  function close() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    document.body.style.overflow = "";
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="grain fixed inset-0 z-[120] flex flex-col items-center justify-center bg-ink text-bone"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: "-100%" }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE }}>
            <Wordmark animated name={config.brand.name} height={44} />
          </motion.div>
          <motion.p
            className="display-italic mt-8 max-w-sm px-6 text-center text-lg text-bone/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.9, ease: EASE }}
          >
            {i18nText(config.brand.tagline, locale)}
          </motion.p>
          <button
            type="button"
            onClick={close}
            className="absolute bottom-10 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-bone/60 transition hover:text-bone"
          >
            {t("common.skipIntro")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

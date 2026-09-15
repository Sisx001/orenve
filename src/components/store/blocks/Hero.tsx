"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { LocaleLink } from "@/components/store/LocaleLink";
import { headlineLines } from "@/lib/store/richtext";
import { EASE } from "@/lib/store/motion";
import { cn } from "@/lib/utils";

export type HeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta?: string;
  ctaLink?: string;
  secondary?: string;
  secondaryLink?: string;
  caption?: string;
  images: string[];
  video?: string;
  poster?: string;
  focal?: string;
  overlay?: number;
};

/** Full-viewport cinematic opener: parallax media, masked headline, slide rail. */
export function Hero({ eyebrow, title, subtitle, cta, ctaLink = "/shop", secondary, secondaryLink = "/about", caption, images, video, poster, focal = "50% 35%", overlay = 0.25 }: HeroProps) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [slide, setSlide] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const frames = images.length > 0 ? images : [];

  useEffect(() => {
    if (video || frames.length < 2 || reduced) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % frames.length), 6200);
    return () => clearInterval(id);
  }, [video, frames.length, reduced]);

  const lines = headlineLines(title);
  const subLines = subtitle ? headlineLines(subtitle) : [];

  return (
    <section ref={ref} className="relative isolate flex min-h-[92dvh] items-end overflow-hidden bg-coal text-snow" aria-label={lines.join(" ")}>
      {/* media */}
      <motion.div className="absolute inset-0 -z-10" style={reduced ? undefined : { y: mediaY, scale: mediaScale }}>
        {video ? (
          <video
            src={video}
            poster={poster || frames[0]}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
            style={{ objectPosition: focal }}
          />
        ) : (
          frames.map((src, i) => (
            <div
              key={src}
              className={cn("absolute inset-0 transition-opacity duration-[1600ms] ease-editorial", i === slide ? "opacity-100" : "opacity-0")}
              aria-hidden={i !== slide}
            >
              <Image
                src={src}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
                style={{ objectPosition: focal }}
              />
            </div>
          ))
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-coal via-coal/25 to-coal/10" style={{ opacity: Math.min(1, Math.max(0, overlay)) + 0.35 }} />
      </motion.div>
      <span aria-hidden className="grain absolute inset-0 -z-10" />

      {/* content */}
      <motion.div className="container-page w-full pb-20 pt-40 md:pb-28" style={reduced ? undefined : { y: contentY, opacity: contentOpacity }}>
        {eyebrow && (
          <motion.p
            className="eyebrow text-snow/70"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
          >
            {eyebrow}
          </motion.p>
        )}

        <h1 className="display mt-6 max-w-5xl text-display-xl">
          {lines.map((line, i) => (
            <span key={i} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className={cn("block", i % 2 === 1 && "display-italic text-brass")}
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.12 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        {subLines.length > 0 && (
          <motion.p
            className="mt-7 max-w-md text-[0.95rem] leading-relaxed text-snow/80"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
          >
            {subLines.map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
          </motion.p>
        )}

        <motion.div
          className="mt-10 flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.7 }}
        >
          {cta && (
            <LocaleLink href={ctaLink} className="btn border-snow bg-snow text-coal hover:border-oxide hover:bg-oxide hover:text-snow">
              {cta}
            </LocaleLink>
          )}
          {secondary && (
            <LocaleLink href={secondaryLink} className="btn-outline border-snow/50 text-snow hover:bg-snow hover:text-coal">
              {secondary}
            </LocaleLink>
          )}
        </motion.div>

        <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
          {caption && <p className="display-italic max-w-xs text-sm text-snow/60">{caption}</p>}

          <div className="flex items-center gap-6">
            {!video && frames.length > 1 && (
              <div className="flex items-center gap-2" role="tablist" aria-label={lines.join(" ")}>
                {frames.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    role="tab"
                    aria-selected={i === slide}
                    aria-label={`${i + 1} / ${frames.length}`}
                    onClick={() => setSlide(i)}
                    className={cn("h-px w-10 transition-all duration-500", i === slide ? "bg-snow" : "bg-snow/30 hover:bg-snow/60")}
                  />
                ))}
              </div>
            )}
            <span className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.18em] text-snow/50">
              <ArrowDown className="h-3 w-3 animate-pulseDot" aria-hidden />
              {t("common.scroll")}
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Reveal } from "@/components/store/Reveal";

/** Motion study: poster until the visitor asks for sound and motion. */
export function VideoBlock({ url, poster, eyebrow, title }: { url: string; poster?: string; eyebrow?: string; title?: string }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  if (!url) return null;

  return (
    <section className="section">
      <div className="container-page">
        <Reveal>
          {(eyebrow || title) && (
            <div className="mb-8">
              <p className="eyebrow">{eyebrow ?? t("home.videoEyebrow")}</p>
              {title && <h2 className="display mt-4 text-display-sm">{title}</h2>}
            </div>
          )}
          <div className="relative overflow-hidden bg-ink">
            <span className="block aspect-video w-full">
              {playing ? (
                <video src={url} poster={poster} controls autoPlay playsInline className="h-full w-full object-cover" />
              ) : (
                <>
                  {poster && <img src={poster} alt="" aria-hidden loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    className="group absolute inset-0 flex items-center justify-center bg-ink/40 text-bone transition hover:bg-ink/25"
                  >
                    <span className="flex items-center gap-3 border border-bone/50 px-7 py-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] transition group-hover:border-bone">
                      <Play className="h-3.5 w-3.5" aria-hidden />
                      {t("home.videoEyebrow")}
                    </span>
                  </button>
                </>
              )}
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

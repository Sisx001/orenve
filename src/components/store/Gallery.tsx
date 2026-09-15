"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus, Play } from "lucide-react";
import { Modal } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { useFeatures } from "@/components/providers/ConfigProvider";
import { cn } from "@/lib/utils";

export type GalleryImage = { url: string; alt: string };

/**
 * Product gallery.
 * Desktop: stacked frames with a hover zoom lens. Mobile: scroll-snap rail with dots.
 * Both open a draggable, zoomable lightbox.
 */
export function Gallery({ images, video, className }: { images: GalleryImage[]; video?: string | null; className?: string }) {
  const t = useT();
  const features = useFeatures();
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setActive(Math.max(0, Math.min(images.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [images.length]);

  if (images.length === 0) {
    return <div className={cn("skeleton aspect-[3/4] w-full", className)} aria-hidden />;
  }

  return (
    <div className={className}>
      {/* mobile rail */}
      <div className="md:hidden">
        <div ref={railRef} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto" aria-label={t("product.enlarge", { n: 1 })}>
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setLightbox(i)}
              className="relative w-full shrink-0 snap-center"
              aria-label={t("product.enlarge", { n: i + 1 })}
            >
              <span className="block aspect-[3/4] w-full bg-bone">
                <img src={img.url} alt={img.alt} loading={i === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
              </span>
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}`}
                aria-current={active === i}
                onClick={() => railRef.current?.scrollTo({ left: i * (railRef.current?.clientWidth ?? 0), behavior: "smooth" })}
                className={cn("h-1.5 w-1.5 rounded-full transition", active === i ? "w-5 bg-ink" : "bg-line")}
              />
            ))}
          </div>
        )}
      </div>

      {/* desktop stack */}
      <div className="hidden flex-col gap-3 md:flex">
        {images.map((img, i) => (
          <ZoomFrame key={`${img.url}-${i}`} image={img} index={i} onOpen={() => setLightbox(i)} label={t("product.enlarge", { n: i + 1 })} />
        ))}

        {features.productVideo && video && (
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-coal">
            {showVideo ? (
              <video src={video} controls autoPlay playsInline className="h-full w-full object-cover" />
            ) : (
              <button type="button" onClick={() => setShowVideo(true)} className="group absolute inset-0 flex items-center justify-center bg-coal/70 text-snow">
                <span className="flex items-center gap-3 border border-paper/40 px-6 py-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] transition group-hover:border-paper">
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  {t("home.videoEyebrow")}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 hidden text-[0.62rem] uppercase tracking-[0.16em] text-muted md:block">{t("product.zoomHint")}</p>

      <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </div>
  );
}

/** Single desktop frame with a cursor-following zoom lens. */
function ZoomFrame({ image, index, onOpen, label }: { image: GalleryImage; index: number; onOpen: () => void; label: string }) {
  const [origin, setOrigin] = useState("50% 50%");
  const [zoom, setZoom] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setZoom(true)}
      onMouseLeave={() => setZoom(false)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
      }}
      aria-label={label}
      className="group relative block w-full overflow-hidden bg-bone"
      data-cursor="+"
    >
      <span className="block aspect-[3/4] w-full">
        <img
          src={image.url}
          alt={image.alt}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={index === 0 ? "high" : "auto"}
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-editorial"
          style={{ transformOrigin: origin, transform: zoom ? "scale(1.7)" : "scale(1)" }}
        />
      </span>
    </button>
  );
}

/** Draggable / zoomable lightbox. Pinch is handled by the browser on touch. */
function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: GalleryImage[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const t = useT();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setScale(1);
  }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onIndex]);

  const img = index === null ? null : images[index];

  return (
    <Modal open={index !== null} onClose={onClose} side="center" className="h-[92dvh] max-h-[92dvh] w-full max-w-6xl bg-coal text-snow" title={t("product.enlarge", { n: (index ?? 0) + 1 })}>
      {img && (
        <div className="relative flex h-full min-h-[60vh] items-center justify-center overflow-hidden">
          <motion.img
            key={img.url}
            src={img.url}
            alt={img.alt}
            drag
            dragMomentum={false}
            dragElastic={0.06}
            onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2.2))}
            animate={{ scale }}
            transition={{ duration: 0.4 }}
            className="max-h-full max-w-full cursor-grab touch-pan-y object-contain active:cursor-grabbing"
            draggable={false}
          />

          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setScale((s) => Math.max(1, s - 0.4))} aria-label="−" className="border border-snow/30 p-2 hover:border-snow">
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setScale((s) => Math.min(4, s + 0.4))} aria-label="+" className="border border-snow/30 p-2 hover:border-snow">
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <span className="text-[0.62rem] uppercase tracking-[0.18em] text-snow/70">
              {index !== null ? index + 1 : 0} / {images.length}
            </span>
            {images.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => index !== null && onIndex((index - 1 + images.length) % images.length)}
                  aria-label={t("common.previous")}
                  className="border border-snow/30 p-2 hover:border-snow"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => index !== null && onIndex((index + 1) % images.length)}
                  aria-label={t("common.next")}
                  className="border border-snow/30 p-2 hover:border-snow"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

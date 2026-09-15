"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useFeatures } from "@/components/providers/ConfigProvider";

/**
 * Fine-pointer only cursor companion. Any element with `data-cursor="…"`
 * swaps the dot for a labelled disc. Purely decorative.
 */
export function CustomCursor() {
  const features = useFeatures();
  const reduced = useReducedMotion();
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!features.customCursor || reduced) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;

    const move = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!active) setActive(true);
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cursor]");
      setLabel(el?.dataset.cursor ?? null);
    };
    const leave = () => setActive(false);

    const tick = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      if (dot.current) dot.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", move);
    document.addEventListener("mouseleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features.customCursor, reduced]);

  if (!features.customCursor || reduced) return null;

  return (
    <div
      ref={dot}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[110] hidden select-none items-center justify-center rounded-full border border-ink/40 bg-paper/70 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-ink backdrop-blur-sm transition-[width,height,opacity] duration-300 ease-editorial [@media(pointer:fine)]:flex"
      style={{
        width: label ? 64 : 10,
        height: label ? 64 : 10,
        opacity: active ? 1 : 0,
      }}
    >
      {label}
    </div>
  );
}

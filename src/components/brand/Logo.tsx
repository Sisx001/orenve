"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * ORYNVE identity — v2.
 *
 * Monogram: a cut ring ("O") whose gap is closed by an oblique stroke — the
 * "quiet rebellion" mark. Wordmark: geometric capitals with a lowered V vertex
 * and a cut R leg, drawn as strokes so it inherits currentColor and animates.
 */

const LETTERS: Record<string, string> = {
  O: "M30 6C15 6 7 16 7 32S15 58 30 58S53 48 53 32S45 6 30 6Z",
  R: "M9 58V6H30C43 6 50 12 50 22S43 38 30 38H9M31 38L52 58",
  Y: "M6 6L29 34L52 6M29 34V58",
  N: "M9 58V6L50 58V6",
  V: "M6 6L29 58L52 6",
  E: "M50 6H9V58H50M9 32H42",
};

export function Monogram({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="ORYNVE monogram"
      fill="none"
      stroke="currentColor"
      strokeWidth="5.5"
      strokeLinecap="square"
    >
      {/* cut ring */}
      <path d="M46.5 14.5A22 22 0 1 0 51 42" />
      {/* oblique closing stroke */}
      <path d="M38 50L58 10" className="text-oxide" stroke="rgb(var(--c-oxide))" />
    </svg>
  );
}

export function Wordmark({
  className,
  animated = false,
  name = "ORYNVE",
  height = 22,
}: {
  className?: string;
  animated?: boolean;
  name?: string;
  height?: number;
}) {
  const reduced = useReducedMotion();
  const animate = animated && !reduced;
  const letters = name.toUpperCase().split("");
  const allKnown = letters.every((l) => LETTERS[l]);

  if (!allKnown) {
    return (
      <span className={cn("display text-2xl tracking-[0.12em]", className)} style={{ fontSize: height * 1.3 }}>
        {name.toUpperCase()}
      </span>
    );
  }

  const width = letters.length * 60;
  return (
    <svg
      viewBox={`0 0 ${width} 64`}
      height={height}
      width={(width / 64) * height}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label={name}
      fill="none"
      stroke="currentColor"
      strokeWidth="6.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {letters.map((l, i) => (
        <motion.path
          key={i}
          d={LETTERS[l]}
          transform={`translate(${i * 60},0)`}
          initial={animate ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: i * 0.08, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      {/* signature accent: the V vertex gets the oxide dot */}
      {letters.map((l, i) =>
        l === "V" ? (
          <circle key={`dot-${i}`} cx={i * 60 + 29} cy="58" r="3.4" fill="rgb(var(--c-oxide))" stroke="none" />
        ) : null,
      )}
    </svg>
  );
}

export function Logo({
  className,
  animated,
  name,
  withMonogram = true,
}: {
  className?: string;
  animated?: boolean;
  name?: string;
  withMonogram?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {withMonogram && <Monogram size={28} />}
      <Wordmark animated={animated} name={name} />
    </span>
  );
}

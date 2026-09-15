/**
 * Shared editorial motion language for the storefront.
 * One easing curve, a few durations — used everywhere so the whole site
 * moves with the same hand.
 */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_SNAP: [number, number, number, number] = [0.76, 0, 0.24, 1];

export const DUR = {
  fast: 0.4,
  base: 0.7,
  slow: 1.1,
} as const;

/** Stagger helper: delay for the nth item in a revealed group. */
export function stagger(index: number, step = 0.07, max = 0.5) {
  return Math.min(index * step, max);
}

export const riseVariants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0 },
};

export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

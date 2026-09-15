"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { DUR, EASE } from "@/lib/store/motion";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
  duration?: number;
} & Omit<HTMLMotionProps<"div">, "initial" | "whileInView" | "transition" | "viewport" | "children">;

/** Scroll-triggered rise + fade. Honours reduced motion through MotionConfig. */
export function Reveal({ children, delay = 0, y = 26, className, once = true, duration = DUR.base, ...rest }: RevealProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-12% 0px -8% 0px" }}
      transition={{ duration, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Reveals each child with a stagger. Children must be an array. */
export function RevealGroup({ children, className, step = 0.08 }: { children: ReactNode[]; className?: string; step?: number }) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} delay={Math.min(i * step, 0.6)}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

import type { CSSProperties } from "react";

export const C = {
  bg:        "#060608",
  bgRaised:  "#0a0a0e",
  border:    "rgba(255,255,255,0.08)",
  borderHi:  "rgba(255,255,255,0.14)",
  borderGlow:"rgba(255,255,255,0.22)",
  text:      "#ffffff",
  muted:     "rgba(255,255,255,0.45)",
  faint:     "rgba(255,255,255,0.22)",
  dimmed:    "rgba(255,255,255,0.12)",
  surface:   "rgba(255,255,255,0.04)",
  surfaceHi: "rgba(255,255,255,0.07)",
  accent:    "#ffffff",
} as const;

export const GLASS = {
  bg: "rgba(14,14,20,0.55)",
  bgStrong: "rgba(10,10,14,0.72)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderHi: "1px solid rgba(255,255,255,0.18)",
  blur: "blur(28px) saturate(180%)",
  blurLight: "blur(16px) saturate(160%)",
  innerHL: "inset 0 1px 0 rgba(255,255,255,0.08)",
  shadowSoft: "0 8px 32px rgba(0,0,0,0.45)",
  shadowDeep: "0 12px 48px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.5)",
  glow: "0 0 0 1px rgba(255,255,255,0.04), 0 0 32px rgba(255,255,255,0.04)",
} as const;

export const PANEL_GLASS: CSSProperties = {
  background: `linear-gradient(160deg, rgba(28,28,38,0.55) 0%, rgba(14,14,22,0.55) 100%)`,
  border: GLASS.border,
  backdropFilter: GLASS.blur,
  WebkitBackdropFilter: GLASS.blur,
  boxShadow: [
    GLASS.innerHL,
    "inset 0 0 0 1px rgba(255,255,255,0.02)",
    GLASS.shadowDeep,
  ].join(", "),
};

export const PANEL_GLASS_SM: CSSProperties = {
  background: "rgba(20,20,28,0.55)",
  border: GLASS.border,
  backdropFilter: GLASS.blurLight,
  WebkitBackdropFilter: GLASS.blurLight,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.5)",
};

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.8 };

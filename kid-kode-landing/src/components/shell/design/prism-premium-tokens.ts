// PRISM PREMIUM — SHELL TOKEN LAYER, TS MIRROR (SHELL W0, 2026-07-04)
//
// Typed export of the --pp-* custom properties in prism-premium.css, for code
// that needs literal values: THREE material colors in showpiece islands,
// inline style objects, canvas-drawn chrome. EXTENDS the canonical premium.ts
// RED/BLACK/WHITE system by importing it — the identity hexes live in ONE
// place (premium.ts); this module adds the shell's elevation, spacing,
// radius, hairline, and motion vocabulary on top (DL1/DL6/DL7).
//
// Lockstep rule: any value that also appears in prism-premium.css changes in
// both files or neither.

import {
  CHROME,
  CHROME_HI,
  CHROME_LO,
  GUNMETAL,
  GUNMETAL_DEEP,
  GUNMETAL_LIT,
  RED_DEEP,
  RED_HOT,
  SIGNAL_RED,
  SMOKED_GLASS,
  BEZEL_CHROME,
  GLASS_BACKING,
  rbwAlpha,
} from '@/components/editor/design-system/premium';

// Re-export the canonical identity so shell code has a single import surface
// and never reaches into editor paths ad hoc.
export {
  CHROME,
  CHROME_HI,
  CHROME_LO,
  GUNMETAL,
  GUNMETAL_DEEP,
  GUNMETAL_LIT,
  RED_DEEP,
  RED_HOT,
  SIGNAL_RED,
  SMOKED_GLASS,
  BEZEL_CHROME,
  GLASS_BACKING,
  rbwAlpha,
};

/** DL1 — true-black OLED base + machined grey elevation steps.
 *  Steps 1/2/4 are the premium.ts GUNMETAL family; 3/5 are its interpolated
 *  neighbors (5 = the RBW keycap top stop). */
export const PP_ELEVATION = {
  e0: '#000000',
  e1: GUNMETAL_DEEP, // #0b0b10
  e2: GUNMETAL, // #16161d
  e3: '#1d1d25',
  e4: GUNMETAL_LIT, // #23232c
  e5: '#2b2b35',
} as const;

/** Text ramp — chrome engraving on black (dark-first). */
export const PP_TEXT = {
  hi: CHROME_HI, // #f6f8fb
  body: CHROME, // #e8ecf2
  mid: CHROME_LO, // #9aa1ac
  low: '#5f636c',
} as const;

/** DL7 — crisp 1px hairline treatments. */
export const PP_HAIRLINE = {
  width: 1,
  line: rbwAlpha(CHROME, 0.14),
  strong: rbwAlpha(CHROME, 0.26),
  shadow: 'rgba(0, 0, 0, 0.70)',
  red: rbwAlpha(SIGNAL_RED, 0.55),
} as const;

/** DL7 — 4px machining grid. */
export const PP_SPACE = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
} as const;

/** DL7 — exact geometry radii. */
export const PP_RADIUS = {
  r1: 2,
  r2: 4,
  r3: 6,
  r4: 10,
  r5: 16,
  pill: 999,
} as const;

/** DL6 — motion with weight. Durations in ms; every curve carries mass.
 *  `linear` is forbidden on hero interactions and deliberately absent. */
export const PP_MOTION = {
  fast: 140,
  base: 220,
  settle: 420,
  hero: 700,
  easeSettle: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeGravity: 'cubic-bezier(0.55, 0, 0.1, 1)',
  easeWeight: 'cubic-bezier(0.34, 1.28, 0.44, 1)',
  easeHero: 'cubic-bezier(0.83, 0, 0.17, 1)',
} as const;

/** The whole layer, one import. */
export const PP = {
  red: SIGNAL_RED,
  redDeep: RED_DEEP,
  redHot: RED_HOT,
  chrome: CHROME,
  chromeHi: CHROME_HI,
  chromeLo: CHROME_LO,
  elevation: PP_ELEVATION,
  text: PP_TEXT,
  hairline: PP_HAIRLINE,
  space: PP_SPACE,
  radius: PP_RADIUS,
  motion: PP_MOTION,
} as const;

/** Numeric hex (0xRRGGBB) for THREE.Color in showpiece islands. */
export function ppHexNumber(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

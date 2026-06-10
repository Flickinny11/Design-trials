// PRISM EDITOR DESIGN SYSTEM — tokens.ts (Wave 0, FROZEN CONTRACT 2026-06-09)
//
// The JS mirror of tokens.css for code that needs literal values: icon tints,
// three.js light/material colors, canvas-drawn chrome, inline style objects.
// These MUST stay in lockstep with tokens.css — change both or neither.
// Component-local hex values are forbidden; import from here instead.

export const DS = {
  // Neutrals — machined graphite housing
  void: '#04050a',
  ink: '#0b0d13',
  charcoal: '#12151d',
  graphite: '#1a1e28',
  slate: '#242936',
  steel: '#323848',

  // Text — bone engraving
  textHi: '#f3f1ea',
  text: '#dfdcd2',
  textMid: '#a8a79e',
  textLow: '#6e7077',

  // Brass accent ramp
  brass100: '#f7e9c6',
  brass200: '#ecd49d',
  brass300: '#ddba77',
  brass400: '#cd9f55', // primary accent
  brass500: '#b3853f',
  brass600: '#8f6930',
  brass700: '#654a22',

  // Ice secondary (informational / frozen only)
  ice200: '#cfdde6',
  ice300: '#a9c2d1',
  ice400: '#7d9fb4',
  ice500: '#54788d',

  // Status
  ok: '#63c389',
  warn: '#dfa14e',
  danger: '#d96a5e',
  neutral: '#76808f',
} as const;

/** Primary accent — use for active states, selection, primary actions. */
export const DS_ACCENT = DS.brass400;
/** Hot specular point of the accent ramp. */
export const DS_ACCENT_HI = DS.brass200;
/** Deep shade of the accent ramp. */
export const DS_ACCENT_LO = DS.brass600;

/** Numeric hex (0xRRGGBB) for three.js colors. */
export function dsHexNumber(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/** `rgba()` string from a DS hex + alpha — for inline-style composition. */
export function dsAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Category tint map for graph/catalog chrome — restrained, no purple. */
export const DS_CATEGORY_TINTS: Record<string, string> = {
  default: DS.brass400,
  motion: DS.brass300,
  surface: DS.ice300,
  light: DS.brass200,
  volume: DS.ice400,
  glass: DS.ice200,
  text: DS.textMid,
  particles: DS.warn,
  interaction: DS.ok,
};

/** Difficulty tints (catalog tiles) — brass ramp, never purple. */
export const DS_DIFFICULTY: Record<string, string> = {
  easy: DS.ok,
  medium: DS.brass300,
  hard: DS.warn,
};

export const DS_MOTION = {
  fast: 120,
  base: 200,
  slow: 320,
  glide: 480,
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeIn: 'cubic-bezier(0.5, 0, 0.74, 0.24)',
  easeInOut: 'cubic-bezier(0.6, 0, 0.18, 1)',
  spring: 'cubic-bezier(0.34, 1.36, 0.44, 1)',
} as const;

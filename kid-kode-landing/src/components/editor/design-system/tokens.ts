// PRISM EDITOR DESIGN SYSTEM — tokens.ts (Wave 0, FROZEN CONTRACT 2026-06-09)
//
// The JS mirror of tokens.css for code that needs literal values: icon tints,
// three.js light/material colors, canvas-drawn chrome, inline style objects.
// These MUST stay in lockstep with tokens.css — change both or neither.
// Component-local hex values are forbidden; import from here instead.

// CHROME OVERHAUL 2026-06-15: these hex are the EXACT sRGB render of the OKLCH
// source tokens in tokens.css (Observatory-Brass, enriched/lifted). They feed
// THREE.Color in the chrome-layer slab shaders + inline styles. Keep in lockstep
// with tokens.css — change both or neither.
export const DS = {
  // Neutrals — machined graphite housing (lifted/warmer so panels read as lit)
  void: '#030408',
  ink: '#0d1117',
  charcoal: '#181c23',
  graphite: '#232830',
  slate: '#313741',
  steel: '#414854',

  // Text — bone engraving
  textHi: '#f3f0e7',
  text: '#e2e0d7',
  textMid: '#aaa7a1',
  textLow: '#6f7379',

  // Brass accent ramp (richer — more chroma so accents catch light)
  brass100: '#f7e9c3',
  brass200: '#f2d193',
  brass300: '#e7b66a',
  brass400: '#d99b47', // primary accent
  brass500: '#c08137',
  brass600: '#98622a',
  brass700: '#6d441c',

  // Ice secondary (informational / frozen only)
  ice200: '#c4dae5',
  ice300: '#9dbbcb',
  ice400: '#7398ae',
  ice500: '#4d7389',

  // Status
  ok: '#5fc889',
  warn: '#e1ab5c',
  danger: '#dd675b',
  neutral: '#727985',
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

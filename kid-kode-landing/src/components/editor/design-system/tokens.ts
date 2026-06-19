// PRISM EDITOR DESIGN SYSTEM — tokens.ts (Wave 0, FROZEN CONTRACT 2026-06-09)
//
// The JS mirror of tokens.css for code that needs literal values: icon tints,
// three.js light/material colors, canvas-drawn chrome, inline style objects.
// These MUST stay in lockstep with tokens.css — change both or neither.
// Component-local hex values are forbidden; import from here instead.

// PRISM PORT F0 (de-brass 2026-06-19): these hex are the sRGB render of the OKLCH
// source tokens in tokens.css. They feed THREE.Color in the chrome-layer slab
// shaders + inline styles. Keep in lockstep with tokens.css — change both or
// neither. LOCKED IDENTITY: machined chrome / titanium / mercury metals on a
// near-black substrate; anodized blue as a TINT; arc-cyan as the SINGLE emissive
// accent. ZERO brass/gold/amber. No purple. No pure #fff / #000.
export const DS = {
  // Neutrals — machined graphite housing
  void: '#030408',
  ink: '#0d1117',
  charcoal: '#181c23',
  graphite: '#232830',
  slate: '#313741',
  steel: '#414854',

  // Text — bright machined-metal engraving (cool neutral)
  textHi: '#dfe2e6',
  text: '#cdd1d6',
  textMid: '#a5a8ab',
  textLow: '#6f7379',

  // Metal ramp — machined chrome -> titanium -> graphite shadow (cool, neutral)
  metal100: '#eef0f3', // mercury highlight / specular hot point
  metal200: '#dfe2e6', // chrome
  metal300: '#c6c9cd',
  metal400: '#b8bcc0', // titanium — primary metal face
  metal500: '#898c92',
  metal600: '#575b61',
  metal700: '#32363c', // shadowed flank

  // Arc — the SINGLE emissive / active accent + anodized TINT companion
  arc: '#1ec8ff',        // arc-cyan — active state, selection, emission
  arcHot: '#96e0ff',     // hot core of the arc
  anodized: '#2d5fa3',   // anodized blue — surface TINT only (never emission)
  warningArc: '#ff8c1e', // warning arc — orange, never gold

  // Ice secondary (informational / frozen only)
  ice200: '#c4dae5',
  ice300: '#9dbbcb',
  ice400: '#7398ae',
  ice500: '#4d7389',

  // Status
  ok: '#5fc889',
  warn: '#ff8c1e',
  danger: '#dd675b',
  neutral: '#727985',
} as const;

/** Primary accent — the single emissive arc-cyan for active states, selection,
 *  primary actions. (Was the brass primary; now arc-cyan per the locked port.) */
export const DS_ACCENT = DS.arc;
/** Hot core of the arc accent. */
export const DS_ACCENT_HI = DS.arcHot;
/** Deep tint companion (anodized blue) — surface tint, not emission. */
export const DS_ACCENT_LO = DS.anodized;

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
  default: DS.metal400,
  motion: DS.metal300,
  surface: DS.ice300,
  light: DS.metal200,
  volume: DS.ice400,
  glass: DS.ice200,
  text: DS.textMid,
  particles: DS.warn,
  interaction: DS.ok,
};

/** Difficulty tints (catalog tiles) — metal ramp, never purple. */
export const DS_DIFFICULTY: Record<string, string> = {
  easy: DS.ok,
  medium: DS.metal300,
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

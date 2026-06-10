// PRISM EDITOR DESIGN SYSTEM — public surface (Wave 0, FROZEN CONTRACT).
//
// import { DS, DS_ACCENT, dsAlpha, useTilt, ensureChromeTier } from
//   '@/components/editor/design-system';
//
// The CSS side (tokens.css + materials.css) is imported once in
// src/app/layout.tsx; the `ds-*` classes are global. RefractionDefs is
// mounted once per page that uses `.ds-glass--refract`.

export {
  DS,
  DS_ACCENT,
  DS_ACCENT_HI,
  DS_ACCENT_LO,
  DS_CATEGORY_TINTS,
  DS_DIFFICULTY,
  DS_MOTION,
  dsAlpha,
  dsHexNumber,
} from './tokens';
export { detectChromeTier, ensureChromeTier, DS_TIER_BOOT_SCRIPT } from './tier';
export type { ChromeTier } from './tier';
export { useTilt } from './use-tilt';
export type { TiltOptions } from './use-tilt';
export { default as RefractionDefs } from './RefractionDefs';

// PRISM EDITOR DESIGN SYSTEM — premium.ts (founder mandate 2026-07-01).
//
// The RED / BLACK / WHITE photoreal system established by the toolbar-premium
// run (notes/TOOLBAR-PREMIUM-REPORT.md §8) and inherited by the keyframe
// editor (FINISH F-1). ONE module holds the shared accent family + material
// constants so the toolbar, the keyframe panel, the /editor keyframe dock and
// the /keyframe-editor lab all reference the same design system:
//
//   black  = machined gunmetal instrument housing
//   white  = brushed chrome / mercury metal
//   red    = SIGNAL_RED — the single accent family (active, record, keys)
//   glass  = smoked dark transmission glass framed in chrome
//
// Additive to ./tokens.ts (the frozen DS neutrals/type tokens stay canonical
// for general chrome); this module is the premium-instrument overlay the
// founder mandated for the toolbar + keyframe surfaces.

// ── The one accent family ────────────────────────────────────────────────────
export const SIGNAL_RED = '#ff2a38'; // hero signal red — the one accent
export const RED_DEEP = '#7d0f18'; // oxblood — gradient depth / shadow side
export const RED_HOT = '#ff5a55'; // white-hot red — emissive cores / glints

// ── The black (machined gunmetal housing) ────────────────────────────────────
export const GUNMETAL = '#16161d'; // crisp dark silhouette (toolbar icon black)
export const GUNMETAL_DEEP = '#0b0b10'; // instrument shadow side
export const GUNMETAL_LIT = '#23232c'; // lit flank of the housing

// ── The white (brushed chrome / mercury) ─────────────────────────────────────
export const CHROME = '#e8ecf2'; // brushed chrome face
export const CHROME_HI = '#f6f8fb'; // mercury specular hot point
export const CHROME_LO = '#9aa1ac'; // chrome turned away from the light

// ── Smoked-glass recipe (the toolbar rail's proven values) ───────────────────
// MeshPhysicalMaterial params for the premium smoked slab: real transmission
// with a dark attenuation body so the glass has visible mass + depth.
export const SMOKED_GLASS = {
  color: '#eaeef5',
  transmission: 1,
  attenuationColor: '#141922',
  attenuationDistance: 3.1,
  envMapIntensity: 2.7,
} as const;
/** Brushed-chrome bezel metal color (the frame around smoked glass). */
export const BEZEL_CHROME = '#c8cfd9';
/** Dark instrument backing behind smoked glass. */
export const GLASS_BACKING = '#04060a';

// ── DOM chrome recipes (CSS strings for the machined-instrument panels) ──────
// Layered gradients that read as brushed black metal with real edges; used by
// the DOM-hosted keyframe panel (editor overlay chrome, outside no-dom scope).
export const RBW = {
  /** Brushed gunmetal body — the panel housing (fine horizontal brush grain
   *  over the machined gradient so the surface reads as metal, never void). */
  bodyMetal:
    `repeating-linear-gradient(180deg, rgba(246, 248, 251, 0.028) 0 1px, rgba(0, 0, 0, 0.045) 1px 2px, transparent 2px 4px), ` +
    `linear-gradient(178deg, #2b2b35 0%, ${GUNMETAL_LIT} 26%, ${GUNMETAL} 62%, ${GUNMETAL_DEEP} 100%)`,
  /** Machined header strip — brighter brushed band. */
  headerMetal:
    `repeating-linear-gradient(90deg, rgba(246, 248, 251, 0.03) 0 1px, transparent 1px 3px), ` +
    `linear-gradient(180deg, #34343f 0%, ${GUNMETAL_LIT} 48%, ${GUNMETAL} 100%)`,
  /** Chrome bezel hairline stack — specular top edge + shadowed bottom. */
  bezelEdge:
    `inset 0 1px 0 rgba(246, 248, 251, 0.26), inset 0 -1px 0 rgba(0, 0, 0, 0.7), ` +
    `inset 1px 0 0 rgba(246, 248, 251, 0.08), inset -1px 0 0 rgba(0, 0, 0, 0.4), ` +
    `0 0 0 1px rgba(200, 207, 217, 0.12)`,
  /** Recessed machined well (scrubber / lane channel). */
  well:
    `linear-gradient(180deg, #060609 0%, #101017 55%, #14141b 100%)`,
  wellShadow:
    `inset 0 2px 6px rgba(0, 0, 0, 0.85), inset 0 -1px 0 rgba(246, 248, 251, 0.07), ` +
    `0 1px 0 rgba(246, 248, 251, 0.05)`,
  /** Machined keycap (buttons at rest). */
  keycap:
    `linear-gradient(178deg, #2e2e39 0%, ${GUNMETAL_LIT} 40%, ${GUNMETAL} 100%)`,
  keycapShadow:
    `inset 0 1px 0 rgba(246, 248, 251, 0.16), inset 0 -1px 0 rgba(0, 0, 0, 0.6), ` +
    `0 2px 4px rgba(0, 0, 0, 0.5)`,
  /** Red-active keycap treatment. */
  keycapActive:
    `linear-gradient(178deg, rgba(255, 42, 56, 0.28), rgba(125, 15, 24, 0.20)), ` +
    `linear-gradient(178deg, #2e2e39 0%, ${GUNMETAL} 100%)`,
  keycapActiveShadow:
    `inset 0 0 0 1px rgba(255, 42, 56, 0.55), inset 0 1px 0 rgba(255, 90, 85, 0.35), ` +
    `0 0 14px rgba(255, 42, 56, 0.22), 0 2px 4px rgba(0, 0, 0, 0.5)`,
  /** The red jewel key (keyframe diamond) — radial red core + chrome rim. */
  keyJewel:
    `radial-gradient(circle at 32% 28%, ${CHROME_HI} 0%, ${RED_HOT} 22%, ${SIGNAL_RED} 55%, ${RED_DEEP} 100%)`,
  keyJewelRim: `1px solid rgba(246, 248, 251, 0.55)`,
  keyJewelGlow:
    `0 1px 3px rgba(0, 0, 0, 0.6), 0 0 9px rgba(255, 42, 56, 0.55), inset 0 0 2px rgba(255, 255, 255, 0.35)`,
} as const;

/** `rgba()` from a hex + alpha (local copy so premium.ts stays dependency-free). */
export function rbwAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

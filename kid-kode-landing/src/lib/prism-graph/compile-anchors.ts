// compile-anchors.ts — Phase 6 anchor rule table (SC-031).
//
// Spec refs:
//   §6 SC-031  "Per-node anchor rules: a deterministic rule table maps
//               (node.subtype, node.intent, node.serviceTag) → uiAnchor.
//               Rules live in
//               kid-kode-landing/src/lib/prism-graph/compile-anchors.ts."
//   §8 INV-17  Non-destructive compile — the rule fn is pure / read-only.
//   §8 FP-04   No destructive position writes in compile* functions.
//
// `UiAnchor` is the source-side anchor abstraction (gap-analysis §3,
// editor-build-gap-analysis.md:245). The compiled-view side uses a
// different vocabulary (`CompiledAnchor.kind`); mapping happens in
// compile-hub.ts, not here.
//
// EB-06-02 ships the rule fn only; the optional `uiAnchor?` field on
// `PrismNode` is added by EB-08 (additive per INV-18). Until then, callers
// pass the source fields explicitly via `pickUiAnchor(subtype, intent,
// serviceTag)`.

import type { PrismIntent } from './types.ts';

export type UiAnchor =
  | 'world'
  | 'viewport'
  | 'scroll'
  | 'hybrid'
  | 'sticky'
  | 'parallax'
  | 'camera-locked';

export const UI_ANCHOR_VALUES: readonly UiAnchor[] = Object.freeze([
  'world',
  'viewport',
  'scroll',
  'hybrid',
  'sticky',
  'parallax',
  'camera-locked',
] as const);

// Documented fallback for ambiguous (subtype, intent, serviceTag) tuples
// that don't match any rule. Spec haltCheck requires a "documented default":
// the preview compositor can always pin an unknown element to the viewport,
// which is the safest visible-but-not-misplaced behavior.
export const UI_ANCHOR_DEFAULT: UiAnchor = 'viewport';

// --- Dispatch helpers -----------------------------------------------------
//
// Rule classification keys off three inputs:
//
//   1. `subtype` — primary discriminant. Conventional shape is
//      `<role>-<render-mode>` (e.g. `card-plane`, `hero-mesh`,
//      `grid-parallax`) or `<role>-<intent>` (`hero-cta`). Both halves
//      contribute: render-mode `mesh` implies world-space depth,
//      render-mode `parallax` (or the role-suffix `-decor` / `-accent`)
//      implies parallax-bound motion.
//   2. `intent` — read-only override hints. A literal
//      `intent.visualSpec.cameraLocked === true` short-circuits everything
//      to `'camera-locked'` (e.g. HUD overlays welded to the camera).
//   3. `serviceTag` — refines ties. `'action'` reinforces sticky CTAs;
//      `'hud'` reinforces viewport pinning; `'decor'` reinforces parallax.
//
// Order matters: the camera-locked intent flag is consulted first because
// it is the only explicit user override. Subtype-keyword rules then run in
// most-specific-first order. Ambiguous tuples fall through to
// `UI_ANCHOR_DEFAULT` (`'viewport'`), the documented fallback.

function hasCameraLockedHint(intent: PrismIntent): boolean {
  const flag = intent?.visualSpec?.cameraLocked;
  return flag === true;
}

function classifyBySubtype(subtype: string): UiAnchor | null {
  const s = subtype.toLowerCase();

  // 3D mesh elements live in hub-scene world space (depth-aware).
  if (s.endsWith('-mesh') || s.includes('mesh-')) return 'world';

  // Parallax render-mode or decorative roles bind to the parallax track.
  if (s.includes('parallax')) return 'parallax';
  if (s.endsWith('-decor') || s.endsWith('-accent') || s.includes('orbital'))
    return 'parallax';

  // CTAs are sticky-pinned regardless of render-mode suffix.
  if (s.includes('cta')) return 'sticky';

  // Scroll-pinned content blocks (cards, thumbnails, tiers).
  if (
    s.includes('card') ||
    s.includes('thumbnail') ||
    s.includes('tier') ||
    s.includes('showcase')
  ) {
    return 'scroll';
  }

  // Viewport-pinned auxiliary chrome (social, headline, hero non-CTA).
  if (s.includes('social') || s.includes('headline') || s.includes('hero'))
    return 'viewport';

  return null;
}

function classifyByServiceTag(serviceTag: string): UiAnchor | null {
  const t = serviceTag.toLowerCase();
  if (t === 'action') return 'sticky';
  if (t === 'hud') return 'viewport';
  if (t === 'decor') return 'parallax';
  return null;
}

// --- Public rule entrypoint (SC-031). -------------------------------------

export function pickUiAnchor(
  subtype: string,
  intent: PrismIntent,
  serviceTag: string,
): UiAnchor {
  // 1. Explicit intent override wins.
  if (hasCameraLockedHint(intent)) return 'camera-locked';

  // 2. Subtype is the strongest deterministic signal.
  const fromSubtype = classifyBySubtype(subtype);
  if (fromSubtype !== null) return fromSubtype;

  // 3. Service tag refines tie-cases when the subtype was uninformative.
  const fromServiceTag = classifyByServiceTag(serviceTag);
  if (fromServiceTag !== null) return fromServiceTag;

  // 4. Documented fallback.
  return UI_ANCHOR_DEFAULT;
}

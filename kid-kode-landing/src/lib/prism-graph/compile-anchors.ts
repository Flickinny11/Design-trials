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

import type {
  PrismHub,
  PrismHubResponsiveBreakpoint,
  PrismIntent,
} from './types.ts';
import type { CompiledAnchor } from './compiled-view.ts';

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

// --- Phase R2-B / SC-066 — anchor → scene-position resolver. -------------
//
// `resolveAnchorToScenePosition` is the connector between `CompiledHubView`
// and `PrismHost`'s node-layout effect (EBR2-B-03). For each entry in
// `CompiledHubView.nodes[]`, the host walks the compiled anchor and calls
// `liveResult.updateNodeTransform(nodeId, position)` with the result of this
// function. The function is pure / deterministic (INV-17) — it never mutates
// the input anchor, hub, or breakpoint, and never reads anything outside
// those three arguments.
//
// The four `CompiledAnchorKind` spaces resolve as follows (the seven source
// `UiAnchor` values collapse into these four via the
// `UI_ANCHOR_TO_COMPILED_KIND` map in `compiled-view.ts`):
//
//   'world'             → pass-through  (already in 3D hub-scene world space)
//   'hub-scene'         → pass-through  (parallax + hybrid; scene-space coords)
//   'camera'            → pass-through  (camera-local offsets; caller composes
//                                        with the camera pose)
//   'viewport-relative' → mapped        (anchor.x, anchor.y ∈ [0,1] normalized
//                                        in viewport composition space; scaled
//                                        to scene-space using hub.layout
//                                        viewport dimensions and breakpoint
//                                        scale; anchor.z preserved for
//                                        depth-stack ordering)
//
// Viewport-relative mapping: anchor (0,0) is top-left, (1,1) is bottom-right,
// (0.5, 0.5) is the center. The compiled scene-space origin is the hub center
// with y-up; viewport-y must therefore be flipped. The mapping is
//
//   scene.x = (anchor.x - 0.5) * viewportWidth  * scale
//   scene.y = (0.5 - anchor.y) * viewportHeight * scale
//   scene.z =  anchor.z
//
// `breakpoint` is the active responsive breakpoint (e.g. `'desktop' | 'tablet'
// | 'mobile'` resolved from the viewport's current width). When omitted,
// scale defaults to 1.0 (desktop / unscaled). Only `viewport-relative`
// anchors consult the breakpoint; the other three spaces are already
// scene-space and ignore it.

export interface ResolvedScenePosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function resolveAnchorToScenePosition(
  anchor: CompiledAnchor,
  hub: PrismHub,
  breakpoint?: PrismHubResponsiveBreakpoint,
): ResolvedScenePosition {
  switch (anchor.kind) {
    case 'world':
    case 'hub-scene':
    case 'camera':
      return Object.freeze({ x: anchor.x, y: anchor.y, z: anchor.z });
    case 'viewport-relative': {
      const scale = breakpoint?.scale ?? 1;
      const vw = hub.layout?.viewportWidth ?? 0;
      const vh = hub.layout?.viewportHeight ?? 0;
      return Object.freeze({
        x: (anchor.x - 0.5) * vw * scale,
        y: (0.5 - anchor.y) * vh * scale,
        z: anchor.z,
      });
    }
    default: {
      // Exhaustiveness — if CompiledAnchorKind ever grows, the compiler
      // forces a new case via this `never` guard.
      const _exhaustive: never = anchor.kind;
      return Object.freeze({ x: 0, y: 0, z: 0 });
    }
  }
}

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

// Skeleton: returns the default for every input so EB-06-02 dispatch tests
// fail at runtime until the rule body lands in Step 7. Type contract,
// constants, and signature are stable.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function pickUiAnchor(
  subtype: string,
  intent: PrismIntent,
  serviceTag: string,
): UiAnchor {
  return UI_ANCHOR_DEFAULT;
}

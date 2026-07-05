// Section-aware in-view geometry (W8 E8) — the pure math behind the real
// intersection driver. The host projects a built node's world centre through
// the live camera to normalized device coords (NDC: x/y ∈ [-1..1], +y up,
// z < 1 = in front of the far plane) and calls `viewportFromNdc` to turn that
// into a `NodeViewport` the InviewDriver consumes.
//
// This module is DOM-free AND three-free (no camera/vector types) so it stays
// node-testable — the host owns the projection, this owns the interpretation.
//
// Spec: PRISM-SHELL-ENHANCEMENTS-2026-07-04.md E8 (generalize M2's inview
// idiom into a section-aware scroll/reveal driver). Canvas-spec §8.2 driver
// model — the InviewDriver only supplies input; it never authors motion.

import type { NodeViewport } from './drivers';

/** How far past the -1..1 frustum edges a node's centre may sit and still count
 *  as "in view". A small margin so a section whose centre just crossed the edge
 *  (but whose body is still on-screen) keeps playing. */
export const INVIEW_MARGIN = 0.15;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Interpret a projected NDC point as a section viewport state.
 *
 * `progress` maps the vertical axis so a section reads 0 as it enters from the
 * bottom (ndc.y ≈ -1) and 1 as it exits past the top (ndc.y ≈ +1) — the
 * natural scroll-scrub direction. It is defined (clamped) even when the section
 * is off-screen so a scroll-scrubbed timeline holds cleanly at its end edges.
 *
 * `visible` is true while the centre is within the frustum (± INVIEW_MARGIN)
 * and in front of the camera (z < 1). Behind-camera / beyond-far points are
 * never visible.
 */
export function viewportFromNdc(ndc: {
  x: number;
  y: number;
  z: number;
}): NodeViewport {
  const inFront = ndc.z < 1;
  const edge = 1 + INVIEW_MARGIN;
  const visible =
    inFront && ndc.x >= -edge && ndc.x <= edge && ndc.y >= -edge && ndc.y <= edge;
  // ndc.y: +1 top → progress 1 (exiting); -1 bottom → progress 0 (entering).
  const progress = clamp01((ndc.y + 1) / 2);
  return { visible, progress };
}

/**
 * Detect a false→true visibility transition — the moment a reveal ('inview')
 * animation should fire. Returns true only on the rising edge.
 */
export function isEnterTransition(prev: NodeViewport, next: NodeViewport): boolean {
  return !prev.visible && next.visible;
}

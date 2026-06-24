// PRISM KEYFRAME ENGINE — a small, seconds-based keyframe / interpolation model.
//
// WHY NOT Theatre.js (the build prompt's named engine): @theatre/core is headless
// but exposes NO runtime keyframe-AUTHORING API — keyframes are created through
// @theatre/studio, which injects a DOM editing panel. That directly violates this
// surface's hard law (WebGL-only, ZERO DOM UI, enforced by no-dom-ui-gate) and the
// NODE LAW (animation data must be the node schema, not Theatre's project state).
// So the keyframe model is implemented natively here: seconds-based time (never
// fps), per-property tracks, eased interpolation, stored in the selected node's
// `keyframes: PrismKeyframe[]`. The node IS the single source of truth.
//
// Pure logic — no React, no THREE. The store (use-keyframe-store) and the scene
// compose it.

import type { PrismKeyframe } from '@/lib/prism-graph/types';
import { DURATION_S, KEYFRAME_SPACE, TRACK_REST, TRACKS } from './keyframe-config';

export interface KeyNode {
  /** node id — this surface animates ONE selected node */
  id: string;
  caption: string;
  /** the node holds its own animation (NODE LAW, single source of truth). Each
   *  keyframe carries a single track's value in `values: { [trackId]: number }`
   *  and an absolute time `t` in SECONDS. */
  keyframes: PrismKeyframe[];
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** easeInOutCubic — the default segment easing (matches the chassis spin feel). */
function ease(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

interface TrackPoint {
  t: number;
  v: number;
  kf: PrismKeyframe;
}

/** All keyframes that animate `trackId`, sorted ascending by time (seconds). */
export function pointsFor(node: KeyNode, trackId: string): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const kf of node.keyframes) {
    const v = (kf.values as Record<string, number> | undefined)?.[trackId];
    if (typeof v === 'number' && typeof kf.t === 'number') {
      out.push({ t: kf.t, v, kf });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Interpolated value of `trackId` at `timeS` seconds. Empty → the rest pose. */
export function evalTrack(node: KeyNode, trackId: string, timeS: number): number {
  const pts = pointsFor(node, trackId);
  const rest = TRACK_REST[trackId] ?? 0;
  if (pts.length === 0) return rest;
  if (pts.length === 1) return pts[0].v;
  if (timeS <= pts[0].t) return pts[0].v;
  if (timeS >= pts[pts.length - 1].t) return pts[pts.length - 1].v;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (timeS >= a.t && timeS <= b.t) {
      const span = b.t - a.t;
      const k = span > 0 ? (timeS - a.t) / span : 0;
      return a.v + (b.v - a.v) * ease(k);
    }
  }
  return pts[pts.length - 1].v;
}

/** Every track's interpolated value at `timeS`. */
export function evalAll(node: KeyNode, timeS: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tr of TRACKS) out[tr.id] = evalTrack(node, tr.id, timeS);
  return out;
}

const EPS = 0.06; // seconds — keyframes within this window are treated as the same time

/**
 * Set (or move) a keyframe on `trackId` at `timeS` to `value`. Non-destructive to
 * other tracks: an existing keyframe for the SAME track within EPS seconds is
 * updated; otherwise a new single-track keyframe is appended. Returns a NEW
 * keyframes array (the node store swaps it in).
 */
export function setKeyframe(
  keyframes: PrismKeyframe[],
  trackId: string,
  timeS: number,
  value: number,
): PrismKeyframe[] {
  const t = clamp(timeS, 0, DURATION_S);
  const next = keyframes.slice();
  const idx = next.findIndex((kf) => {
    const v = (kf.values as Record<string, number> | undefined)?.[trackId];
    return typeof v === 'number' && typeof kf.t === 'number' && Math.abs(kf.t - t) <= EPS;
  });
  const kf: PrismKeyframe = {
    coordinateSpace: KEYFRAME_SPACE,
    t,
    values: { [trackId]: value },
    ease: 'easeInOutCubic',
  };
  if (idx >= 0) next[idx] = kf;
  else next.push(kf);
  return next;
}

/** Remove the keyframe nearest to `timeS` on `trackId` (if any within EPS). */
export function removeKeyframeNear(
  keyframes: PrismKeyframe[],
  trackId: string,
  timeS: number,
): PrismKeyframe[] {
  const idx = keyframes.findIndex((kf) => {
    const v = (kf.values as Record<string, number> | undefined)?.[trackId];
    return typeof v === 'number' && typeof kf.t === 'number' && Math.abs(kf.t - timeS) <= EPS;
  });
  if (idx < 0) return keyframes;
  const next = keyframes.slice();
  next.splice(idx, 1);
  return next;
}

/** Count of distinct keyframes on a track. */
export function trackKeyframeCount(node: KeyNode, trackId: string): number {
  return pointsFor(node, trackId).length;
}

export { DURATION_S };

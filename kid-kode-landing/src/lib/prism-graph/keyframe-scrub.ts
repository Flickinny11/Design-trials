// FINISH F-1 — Keyframe scrub evaluator (pure).
//
// The root-editor Keyframe panel (overlays/KeyframeEditor.tsx) authors
// `PrismKeyframe`s whose `params` are canvasTransform SNAPSHOTS
// (translateX/Y/Z, rotateX/Y/Z, scaleX/Y/Z, scale, opacity — the shape
// `captureCanvasTransformAsKeyframe` writes). This module interpolates those
// params at a normalized playhead t ∈ [0..1] so the panel's scrub/play can
// drive the selected node's rendered group live in the canvas (the same
// driver pattern the /editor EditorKeyframeDock already proves).
//
// Pure logic — no React, no THREE, no store. Time normalization mirrors the
// panel's lane projection (deriveKeyframeLanes): a keyframe's `t` is used
// as-is when the track's max t ≤ 1 (already normalized), divided by the max
// when absolute, and index-distributed when missing. Segment easing is
// easeInOutCubic (the house curve).

import type { PrismKeyframe } from './types';

/** The transform channels the scrub driver applies. */
export interface ScrubPose {
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  opacity?: number;
}

export const SCRUB_CHANNELS: readonly (keyof ScrubPose)[] = [
  'translateX',
  'translateY',
  'translateZ',
  'rotateX',
  'rotateY',
  'rotateZ',
  'scaleX',
  'scaleY',
  'scaleZ',
  'opacity',
];

function ease(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Point {
  t: number;
  v: number;
}

/** Normalized time for keyframe `idx` of `n`, mirroring the panel's lanes. */
function normT(kf: PrismKeyframe, idx: number, n: number, maxT: number): number {
  if (typeof kf.t === 'number') {
    return maxT > 1 ? kf.t / maxT : clamp01(kf.t);
  }
  return n > 1 ? idx / (n - 1) : 0.5;
}

function channelValue(kf: PrismKeyframe, ch: keyof ScrubPose): number | null {
  const bag = (kf.params ?? kf.values ?? {}) as Record<string, unknown>;
  let v = bag[ch];
  // `scale` (uniform) backfills the per-axis scale channels when absent.
  if (typeof v !== 'number' && (ch === 'scaleX' || ch === 'scaleY' || ch === 'scaleZ')) {
    v = bag.scale;
  }
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Interpolate every present channel of `keyframes` at normalized playhead
 * `t01`. Channels with no keyed value anywhere are omitted (the driver leaves
 * that axis at the node's base pose). Before the first / after the last key a
 * channel holds its end value; a single key holds everywhere (so a captured
 * pose is visible at any scrub position).
 */
export function evalScrubPose(keyframes: readonly PrismKeyframe[], t01: number): ScrubPose {
  const out: ScrubPose = {};
  const n = keyframes.length;
  if (n === 0) return out;
  const t = clamp01(t01);
  const maxT = keyframes.reduce(
    (m, k) => (typeof k.t === 'number' && k.t > m ? k.t : m),
    0,
  );

  for (const ch of SCRUB_CHANNELS) {
    const pts: Point[] = [];
    keyframes.forEach((kf, idx) => {
      const v = channelValue(kf, ch);
      if (v !== null) pts.push({ t: normT(kf, idx, n, maxT), v });
    });
    if (pts.length === 0) continue;
    pts.sort((a, b) => a.t - b.t);
    if (pts.length === 1 || t <= pts[0].t) {
      out[ch] = pts[0].v;
      continue;
    }
    if (t >= pts[pts.length - 1].t) {
      out[ch] = pts[pts.length - 1].v;
      continue;
    }
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        const k = span > 0 ? (t - a.t) / span : 0;
        out[ch] = a.v + (b.v - a.v) * ease(k);
        break;
      }
    }
  }
  return out;
}

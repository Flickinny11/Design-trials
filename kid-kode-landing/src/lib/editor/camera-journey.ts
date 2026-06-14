// APP-REALITY P2 — camera-journey model + sampler (pure, deterministic).
//
// A hub's `cameraKeyframes` (PrismKeyframe[], coordinateSpace:'camera') is an
// ordered list of camera waypoints the Canvas user authors with the free edit
// camera. Preview plays them as a single deterministic fly-in: position/target/
// fov interpolated across evenly-spaced segments with a smoothstep ease.
//
// Same keyframes + same progress → same pose every call (reset-and-replay
// consistent). No global fps, no time stored in the data (INV-4) — `progress`
// is supplied by the caller's clock.

import type { PrismKeyframe, PrismHub } from '../prism-graph/types';

export const JOURNEY_SEG_SECONDS = 1.7;

export interface JourneySample {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
}

export function buildCameraKeyframe(
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  fov: number,
): PrismKeyframe {
  return {
    coordinateSpace: 'camera',
    params: {
      px: round(position.x), py: round(position.y), pz: round(position.z),
      tx: round(target.x), ty: round(target.y), tz: round(target.z),
      fov: round(fov),
    },
  };
}

export function hasJourney(hub: PrismHub | null | undefined): boolean {
  return (hub?.cameraKeyframes?.length ?? 0) >= 2;
}

export function journeyDurationSeconds(keyframes: PrismKeyframe[] | undefined): number {
  const n = keyframes?.length ?? 0;
  return n >= 2 ? (n - 1) * JOURNEY_SEG_SECONDS : 0;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function poseOf(kf: PrismKeyframe): JourneySample {
  const p = (kf.params ?? {}) as Record<string, unknown>;
  return {
    position: { x: num(p.px, 0), y: num(p.py, 0), z: num(p.pz, 18) },
    target: { x: num(p.tx, 0), y: num(p.ty, 0), z: num(p.tz, 0) },
    fov: num(p.fov, 45),
  };
}

// Sample the journey at progress ∈ [0..1] across evenly-spaced segments with a
// per-segment smoothstep ease (so each waypoint is a gentle ease-in/out, not a
// linear robot pan). Clamps at the ends. Deterministic.
export function sampleJourney(
  keyframes: PrismKeyframe[] | undefined,
  progress: number,
): JourneySample | null {
  const kfs = keyframes ?? [];
  if (kfs.length === 0) return null;
  if (kfs.length === 1) return poseOf(kfs[0]);
  const p = Math.min(1, Math.max(0, progress));
  const segCount = kfs.length - 1;
  const scaled = p * segCount;
  const i = Math.min(segCount - 1, Math.floor(scaled));
  const localT = smoothstep(scaled - i);
  const a = poseOf(kfs[i]);
  const b = poseOf(kfs[i + 1]);
  return {
    position: {
      x: lerp(a.position.x, b.position.x, localT),
      y: lerp(a.position.y, b.position.y, localT),
      z: lerp(a.position.z, b.position.z, localT),
    },
    target: {
      x: lerp(a.target.x, b.target.x, localT),
      y: lerp(a.target.y, b.target.y, localT),
      z: lerp(a.target.z, b.target.z, localT),
    },
    fov: lerp(a.fov, b.fov, localT),
  };
}

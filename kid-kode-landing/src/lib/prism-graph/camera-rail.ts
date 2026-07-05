// Camera rail derivation + damped step — pure, no React/Three.js types.
//
// Spec refs:
//   §6 SC-032  preview-hub camera is constrained to a damped cinematic rail
//              computed from CompiledHubView.cameraRail (no manual orbit/drag).
//   §5/§7 INV-23  Compiled-preview camera is constrained, damped, and bounded;
//                 scene edges and blank background are never visible.
//
// Pure data + math. The runtime adapter in src/lib/prism/runtime/camera-rail-driver.ts
// is the only consumer that writes the resulting pose onto a THREE camera.

import type { PrismNode } from './types.ts';
import type {
  CompiledCameraPose,
  CompiledCameraRail,
} from './compiled-view.ts';

export const DEFAULT_FOV_DEG = 50;
export const DEFAULT_RAIL_DAMPING = 0.12;
// Pixel margin added to scene-bound half-extents so the framing never grazes
// the edge of the hub viewport. Keeps the rail safe against minor node-bound
// drift and rounding without driving the camera unnecessarily far back.
export const RAIL_FRAME_MARGIN = 48;
// Multiplier applied to the end-pose distance to compute the start-pose
// distance — a subtle cinematic push-in from `start` → `end` over t∈[0,1].
const RAIL_PUSH_IN_FACTOR = 1.18;

export interface SceneBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface CameraRailInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly nodes: readonly PrismNode[];
  /** Override FOV (degrees). Defaults to DEFAULT_FOV_DEG. */
  readonly fovDeg?: number;
  /** Override damping (0..1]. Defaults to DEFAULT_RAIL_DAMPING. */
  readonly damping?: number;
}

function nodeExtent(node: PrismNode): {
  minX: number; maxX: number;
  minY: number; maxY: number;
  z: number;
} | null {
  const t = node.visual?.transform;
  if (!t || typeof t.x !== 'number' || typeof t.y !== 'number') return null;
  const w = typeof t.width === 'number' ? Math.max(0, t.width) : 0;
  const h = typeof t.height === 'number' ? Math.max(0, t.height) : 0;
  return {
    minX: t.x,
    maxX: t.x + w,
    minY: t.y,
    maxY: t.y + h,
    z: typeof t.z === 'number' ? t.z : 0,
  };
}

/** Compute the world-space bounds the camera must frame: union of the hub
 *  viewport rectangle (centered at origin) and every node's visual extent.
 *  Pure — input is never mutated. */
export function computeSceneBoundsForCamera(input: CameraRailInput): SceneBounds {
  const halfW = input.viewportWidth / 2;
  const halfH = input.viewportHeight / 2;
  let minX = -halfW;
  let maxX = halfW;
  let minY = -halfH;
  let maxY = halfH;
  let minZ = 0;
  let maxZ = 0;
  for (const n of input.nodes) {
    const ext = nodeExtent(n);
    if (!ext) continue;
    if (ext.minX < minX) minX = ext.minX;
    if (ext.maxX > maxX) maxX = ext.maxX;
    if (ext.minY < minY) minY = ext.minY;
    if (ext.maxY > maxY) maxY = ext.maxY;
    if (ext.z < minZ) minZ = ext.z;
    if (ext.z > maxZ) maxZ = ext.z;
  }
  return Object.freeze({ minX, maxX, minY, maxY, minZ, maxZ });
}

/** Distance the camera must sit at to frame `bounds` given FOV (degrees)
 *  and aspect ratio. Larger of width-fit / height-fit wins so neither edge
 *  is exposed. Adds RAIL_FRAME_MARGIN to each half-extent before solving. */
function distanceToFitBounds(
  bounds: SceneBounds,
  fovDeg: number,
  aspect: number,
): number {
  const halfFovRad = (fovDeg * Math.PI) / 360;
  const halfW = (bounds.maxX - bounds.minX) / 2 + RAIL_FRAME_MARGIN;
  const halfH = (bounds.maxY - bounds.minY) / 2 + RAIL_FRAME_MARGIN;
  const distForHeight = halfH / Math.tan(halfFovRad);
  const distForWidth = halfW / Math.tan(halfFovRad) / Math.max(aspect, 1e-6);
  return Math.max(distForHeight, distForWidth);
}

function freezePose(p: CompiledCameraPose): CompiledCameraPose {
  return Object.freeze({
    position: Object.freeze([p.position[0], p.position[1], p.position[2]] as const) as readonly [number, number, number],
    target: Object.freeze([p.target[0], p.target[1], p.target[2]] as const) as readonly [number, number, number],
    fov: p.fov,
  });
}

/** Derive a bounded damped-cinematic camera rail for the hub. The rail keeps
 *  the camera at or beyond the framing distance throughout t∈[0,1] so the
 *  hub viewport and every node's extent stays inside the frustum (INV-23).
 *  Pure — never mutates `input` or any element of `input.nodes`. */
export function deriveCompiledCameraRail(input: CameraRailInput): CompiledCameraRail {
  const fov = input.fovDeg ?? DEFAULT_FOV_DEG;
  const damping = input.damping ?? DEFAULT_RAIL_DAMPING;
  const aspect = input.viewportWidth / Math.max(input.viewportHeight, 1);
  const bounds = computeSceneBoundsForCamera(input);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  // Camera looks toward the far face of the depth extent so nearer nodes
  // pop a touch forward; target Z sits at max-z (front of scene).
  const targetZ = bounds.maxZ;

  const endDistance = distanceToFitBounds(bounds, fov, aspect);
  const startDistance = endDistance * RAIL_PUSH_IN_FACTOR;

  const start: CompiledCameraPose = freezePose({
    position: [centerX, centerY, targetZ + startDistance] as const,
    target: [centerX, centerY, targetZ] as const,
    fov,
  });
  const end: CompiledCameraPose = freezePose({
    position: [centerX, centerY, targetZ + endDistance] as const,
    target: [centerX, centerY, targetZ] as const,
    fov,
  });

  return Object.freeze({
    mode: 'damped-cinematic' as const,
    start,
    end,
    damping,
  });
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return Object.freeze([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as const);
}

/** Pure: pose at `t` along the rail. `t` is clamped to [0, 1]. The fov is
 *  carried from `start`/`end` (both currently identical; preserved per pose
 *  so a Phase 7 task can vary FOV along the rail without contract churn). */
export function evaluateCameraRail(rail: CompiledCameraRail, t: number): CompiledCameraPose {
  const u = clamp01(t);
  return Object.freeze({
    position: lerp3(rail.start.position, rail.end.position, u),
    target: lerp3(rail.start.target, rail.end.target, u),
    fov: lerp(rail.start.fov, rail.end.fov, u),
  });
}

/** Pure damped lerp from `current` toward `target`. `damping` is the per-step
 *  blend factor in (0, 1]; 1.0 snaps immediately, smaller values trail. The
 *  step is unconditionally monotone non-increasing in component distance
 *  (no overshoot). Returns a fresh frozen pose. */
export function stepCameraPoseDamped(
  current: CompiledCameraPose,
  target: CompiledCameraPose,
  damping: number,
): CompiledCameraPose {
  const k = clamp01(damping);
  return Object.freeze({
    position: lerp3(current.position, target.position, k),
    target: lerp3(current.target, target.target, k),
    fov: lerp(current.fov, target.fov, k),
  });
}

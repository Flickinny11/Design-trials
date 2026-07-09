// W-2D — per-hub 2D/3D render-mode helpers (pure, DOM-free, renderer-free).
//
// The 2D composition path is renderer CONFIG, not an engine rewrite
// (I-ENGINE): a 2d hub keeps the SAME PerspectiveCamera, the same scene, the
// same node contract and hub manager. The camera drops to a telephoto FOV
// (`FLAT_HUB_FOV`) and its distance is compensated so the framed viewport
// height is IDENTICAL (`framedHeight = 2 · d · tan(fov/2)` is held constant).
// Perspective depth scaling/parallax collapses below visibility, so the
// composition reads flat / orthographic-equivalent — while 3D accents (mesh
// nodes) still render as lit geometry, and 2d↔3d hub transitions tween
// smoothly on the one camera. No OrthographicCamera class swap, no canvas
// remount, no second scene (FP-R1/FP-R6 respected by construction).
//
// Non-destructive law: `renderMode` is one additive field. Node
// `scenePosition.z`, hub `cameraKeyframes`, and all other depth data are
// preserved verbatim while a hub is 2d — just unused.

import type { HubRenderMode } from './types';

/** Telephoto FOV (degrees) used for the 2d flat composition. At this FOV a
 *  node at z=+1 in a hub framed like the 3d default differs in apparent scale
 *  from z=0 by ~2% — visually flat — while remaining the same projection
 *  pipeline. */
export const FLAT_HUB_FOV = 10;

/** Read-side migration: every hub that predates W-2D (or omits the field)
 *  is a '3d' hub. This is the same additive-default idiom every prior schema
 *  field uses ("default for legacy graphs"), so no data rewrite ever runs. */
export function resolveHubRenderMode(
  hub: { renderMode?: HubRenderMode } | null | undefined,
): HubRenderMode {
  return hub?.renderMode === '2d' ? '2d' : '3d';
}

/** Explicit migration helper for write paths that want the field stamped
 *  (e.g. export/import normalization). Pure — returns a new object when the
 *  field is absent, the same object when already present. */
export function migrateHubRenderMode<T extends { renderMode?: HubRenderMode }>(
  hub: T,
): T & { renderMode: HubRenderMode } {
  if (hub.renderMode === '2d' || hub.renderMode === '3d') {
    return hub as T & { renderMode: HubRenderMode };
  }
  return { ...hub, renderMode: '3d' };
}

const degToRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance that preserves the framed viewport height when the FOV changes:
 *  2·d₁·tan(fov₁/2) = 2·d₂·tan(fov₂/2)  →  d₂ = d₁·tan(fov₁/2)/tan(fov₂/2). */
export function distanceForFovChange(
  fromFovDeg: number,
  fromDistance: number,
  toFovDeg: number,
): number {
  return (
    (fromDistance * Math.tan(degToRad(fromFovDeg) / 2)) /
    Math.tan(degToRad(toFovDeg) / 2)
  );
}

export interface HubCameraComposition {
  fov: number;
  distance: number;
}

/** The camera composition for a hub mode, derived from the host's 3d base
 *  (its default fov + hub-framing distance). '3d' returns the base unchanged;
 *  '2d' returns the telephoto FOV with framing-preserving distance. */
export function hubCameraComposition(
  mode: HubRenderMode,
  base: HubCameraComposition,
): HubCameraComposition {
  if (mode === '2d') {
    return {
      fov: FLAT_HUB_FOV,
      distance: distanceForFovChange(base.fov, base.distance, FLAT_HUB_FOV),
    };
  }
  return { fov: base.fov, distance: base.distance };
}

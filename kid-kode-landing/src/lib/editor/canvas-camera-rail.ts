// EBR2-D-01 / §R2-D SC-071 — Canvas-mode OrbitControls guardrails.
//
// Pure helper consumed by EBR2-D-02's SceneControlsBridge in canvas mode.
//
// Contract (SC-071):
//   In canvas mode, OrbitControls is constrained:
//   `minPolarAngle`/`maxPolarAngle`/`minAzimuthAngle`/`maxAzimuthAngle`/
//   `minDistance`/`maxDistance` are set from the active hub's content envelope
//   + viewport-frame, and pan-target clamps prevent drift past the frame.
//
// Coordinate convention: AssembledSceneContent renders the active hub at the
// scene origin (0, 0, 0) in canvas mode — confirmed by `computeCanvasCameraPose`
// in `canvas-camera.ts`, whose hubCenter is (0,0,0). The rail's `target` is
// therefore the local origin; `panLimits` are deltas applied to that origin.
//
// Unit convention: hub.layout.* and viewportFrame.* are in design pixels (the
// 1440×900 default). To express distances in the same world-unit scale used by
// `CANVAS_CAMERA_STANDOFF.z = 18` (canvas-camera.ts), this module multiplies
// design-px by `CANVAS_DESIGN_PX_TO_SCENE_UNIT`. The constant is chosen so
// that the default 1440-wide frame yields an 18-unit scene width — matching
// the existing canvas-mode standoff so EBR2-D-02 can compose the two without
// further rescaling.

import type { CanvasViewportFrame } from './canvas-viewport-frame';
import type {
  PrismHub,
  PrismHubResponsiveBreakpoint,
} from '../prism-graph/types';

export interface CanvasCameraRail {
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly minPolarAngle: number;
  readonly maxPolarAngle: number;
  readonly minAzimuthAngle: number;
  readonly maxAzimuthAngle: number;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly panLimits: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };
}

// 1440 design-px → 18 scene units (matches CANVAS_CAMERA_STANDOFF.z = 18).
export const CANVAS_DESIGN_PX_TO_SCENE_UNIT = 18 / 1440;

// Field-of-view used to derive framing distance. Mirrors GraphScene.tsx's
// scene-mode camera (45°) — canvas mode renders inside scene mode via
// AssembledSceneContent, so the FOV must match for the framing distance to
// reflect what the user actually sees.
export const CANVAS_RAIL_FOV_DEG = 45;

// Distance window — fractions of the framing-fit distance.
const CANVAS_RAIL_MIN_DISTANCE_FRACTION = 0.4;
const CANVAS_RAIL_MAX_DISTANCE_FRACTION = 1.6;
const CANVAS_RAIL_MIN_DISTANCE_FLOOR = 3;

// Angular guardrails — keep the camera close to a front-facing canvas pose so
// designers cannot accidentally rotate behind the hub. Half-windows in radians
// applied symmetrically around the canvas defaults (polar = π/2, azimuth = 0).
const CANVAS_RAIL_POLAR_HALF_WINDOW = 0.35; // ≈ 20°
const CANVAS_RAIL_AZIMUTH_HALF_WINDOW = 0.35; // ≈ 20°

export function computeCanvasCameraRail(
  hub: PrismHub,
  breakpoint: PrismHubResponsiveBreakpoint | null | undefined,
  viewportFrame: CanvasViewportFrame,
): CanvasCameraRail {
  const scale = breakpoint?.scale ?? 1;

  // Hub content envelope, in scene units.
  const envelopeWidth =
    hub.layout.viewportWidth * scale * CANVAS_DESIGN_PX_TO_SCENE_UNIT;
  const envelopeHeight =
    hub.layout.contentHeight * scale * CANVAS_DESIGN_PX_TO_SCENE_UNIT;

  // Viewport-frame, in scene units.
  const frameWidth = viewportFrame.width * CANVAS_DESIGN_PX_TO_SCENE_UNIT;
  const frameHeight = viewportFrame.height * CANVAS_DESIGN_PX_TO_SCENE_UNIT;

  // Camera must frame the larger of (envelope, frame) on each axis so the
  // viewport-frame chrome is always visible — pulling back further than this
  // would expose the empty world beyond, which SC-071 prohibits.
  const effectiveWidth = Math.max(envelopeWidth, frameWidth);
  const effectiveHeight = Math.max(envelopeHeight, frameHeight);

  const aspect = frameWidth / Math.max(frameHeight, 1e-6);
  const halfFovRad = (CANVAS_RAIL_FOV_DEG * Math.PI) / 360;
  const tanHalfFov = Math.tan(halfFovRad);

  const fitForHeight = effectiveHeight / 2 / tanHalfFov;
  const fitForWidth = effectiveWidth / 2 / tanHalfFov / Math.max(aspect, 1e-6);
  const fitDistance = Math.max(fitForHeight, fitForWidth);

  const minDistance = Math.max(
    CANVAS_RAIL_MIN_DISTANCE_FLOOR,
    fitDistance * CANVAS_RAIL_MIN_DISTANCE_FRACTION,
  );
  const maxDistance = fitDistance * CANVAS_RAIL_MAX_DISTANCE_FRACTION;

  // Pan extent. The camera target may shift only as far as the envelope
  // exceeds the frame on each axis — if the envelope fits inside the frame
  // there is nothing more to see, so panning clamps to zero.
  const halfPanX = Math.max(0, (envelopeWidth - frameWidth) / 2);
  const halfPanY = Math.max(0, (envelopeHeight - frameHeight) / 2);

  return Object.freeze({
    minDistance,
    maxDistance,
    minPolarAngle: Math.PI / 2 - CANVAS_RAIL_POLAR_HALF_WINDOW,
    maxPolarAngle: Math.PI / 2 + CANVAS_RAIL_POLAR_HALF_WINDOW,
    minAzimuthAngle: -CANVAS_RAIL_AZIMUTH_HALF_WINDOW,
    maxAzimuthAngle: CANVAS_RAIL_AZIMUTH_HALF_WINDOW,
    target: Object.freeze({ x: 0, y: 0, z: 0 }),
    panLimits: Object.freeze({
      minX: -halfPanX,
      maxX: halfPanX,
      minY: -halfPanY,
      maxY: halfPanY,
    }),
  });
}

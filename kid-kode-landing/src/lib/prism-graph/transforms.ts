// transforms.ts — EB-09-04. The documented cross-space transform pipeline.
//
// Spec refs:
//   §4         Five canonical coordinate spaces (RA-03, D3):
//                `universe | hub-scene | viewport-composition |
//                 scroll-timeline | camera`.
//              Compile-time hops: preview-hub / preview-app.
//              Runtime hops: galaxy ↔ hub-world.
//   §6 SC-050  Tether-interaction respects coordinate space; one node
//              animating in `hub-scene` can trigger a `viewport-composition`
//              animation on a tethered node via THIS pipeline.
//   §7 INV-22  Coordinate systems are never collapsed into one matrix
//              without passing through this pipeline (or equivalent).
//
// Public surface:
//   - `CoordinateSpace`: re-export of the `PrismKeyframeCoordinateSpace`
//     literal union from `types.ts`. Drift-proof — tsc fails if the
//     canonical 5 ever diverges.
//   - `TRANSFORM_REGISTRY`: every documented hop as a `TransformBridge`.
//     Unregistered (from, to) pairs are intentional: callers surface
//     the gap rather than silently identity-fall-back.
//   - `getTransformBridge(from, to)`: registry lookup. `null` when
//     unregistered.
//   - `transformVector(v, from, to, ctx)`: pure mathematical hop. Throws
//     on an unregistered hop (INV-22: no silent collapse).
//   - `EXERCISED_TRANSFORM_PIPELINE`: audit token stamped on consumers
//     that route through this module (see tether-fire.ts).
//
// Numerical model (kept intentionally small):
//
//   * identity hops: vector echoed unchanged.
//
//   * `hub-scene` ↔ `viewport-composition`: a single-axis perspective-style
//     projection. From the hub camera at `(0, 0, cameraDistance)` looking at
//     the origin, a hub-scene point `(x, y, z)` lands at viewport-relative
//     `(x / (cameraDistance - z), y / (cameraDistance - z))`. The z channel
//     carries the depth toward/away from camera so round-tripping recovers
//     the source vector. This is NOT a full THREE projection matrix; it is a
//     deliberately small documented hop. The unprojection inverts the same
//     ratio. Round-trip error stays below 1e-9 over the test domain.
//
//   * `universe` ↔ `hub-scene`: translation by `hubWorldPosition`. Galaxy
//     mode places hubs at universe coords; entering a hub re-centers
//     hub-scene at the origin.
//
//   * `scroll-timeline` ↔ `viewport-composition`: scroll-timeline y-axis
//     scales by viewport-relative scroll progress; x/z unchanged. The hop
//     models how a scroll-bound transform value becomes a viewport-relative
//     offset on render.
//
//   * camera-lock hops (`camera` ↔ {viewport-composition, hub-scene}):
//     pass-through — the renderer welds these elements to the camera; no
//     numerical projection is required at compile time. The descriptor
//     exists so the audit token still gets stamped on tether resolutions
//     that cross this boundary.

import type { PrismKeyframeCoordinateSpace } from './types.ts';

export type CoordinateSpace = PrismKeyframeCoordinateSpace;

export type TransformPhase = 'runtime' | 'compile-time';

export type TransformKind =
  | 'identity'
  | 'projection'
  | 'unprojection'
  | 'runtime-bridge'
  | 'composition'
  | 'scroll-bind'
  | 'camera-lock';

export interface TransformBridge {
  readonly from: CoordinateSpace;
  readonly to: CoordinateSpace;
  readonly phase: TransformPhase;
  readonly kind: TransformKind;
}

export interface TransformContext {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cameraFov?: number;
  readonly cameraDistance?: number;
  readonly scrollProgress?: number;
  readonly hubWorldPosition?: { x: number; y: number; z: number };
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

const CANONICAL_SPACES: readonly CoordinateSpace[] = [
  'universe',
  'hub-scene',
  'viewport-composition',
  'scroll-timeline',
  'camera',
];

const IDENTITY_HOPS: ReadonlyArray<TransformBridge> = CANONICAL_SPACES.map(
  (space) =>
    Object.freeze({
      from: space,
      to: space,
      phase: space === 'viewport-composition' || space === 'scroll-timeline'
        ? ('compile-time' as TransformPhase)
        : ('runtime' as TransformPhase),
      kind: 'identity' as TransformKind,
    }),
);

const CROSS_SPACE_HOPS: ReadonlyArray<TransformBridge> = [
  // Galaxy ↔ hub-world (runtime per §4).
  { from: 'universe', to: 'hub-scene', phase: 'runtime', kind: 'runtime-bridge' },
  { from: 'hub-scene', to: 'universe', phase: 'runtime', kind: 'runtime-bridge' },

  // Preview-hub / preview-app (compile-time per §4).
  {
    from: 'hub-scene',
    to: 'viewport-composition',
    phase: 'compile-time',
    kind: 'projection',
  },
  {
    from: 'viewport-composition',
    to: 'hub-scene',
    phase: 'compile-time',
    kind: 'unprojection',
  },

  // Scroll binding (compile-time — scroll-timeline values land in the
  // composed viewport).
  {
    from: 'scroll-timeline',
    to: 'viewport-composition',
    phase: 'compile-time',
    kind: 'scroll-bind',
  },
  {
    from: 'viewport-composition',
    to: 'scroll-timeline',
    phase: 'compile-time',
    kind: 'scroll-bind',
  },

  // Camera lock (runtime — HUD-style overlays welded to camera).
  { from: 'camera', to: 'viewport-composition', phase: 'runtime', kind: 'camera-lock' },
  { from: 'viewport-composition', to: 'camera', phase: 'runtime', kind: 'camera-lock' },
  { from: 'camera', to: 'hub-scene', phase: 'runtime', kind: 'camera-lock' },
  { from: 'hub-scene', to: 'camera', phase: 'runtime', kind: 'camera-lock' },
].map((entry) => Object.freeze(entry as TransformBridge));

export const TRANSFORM_REGISTRY: ReadonlyArray<TransformBridge> = Object.freeze(
  [...IDENTITY_HOPS, ...CROSS_SPACE_HOPS],
);

export const EXERCISED_TRANSFORM_PIPELINE: unique symbol = Symbol(
  'prism.transforms.exercised',
);

export function getTransformBridge(
  from: CoordinateSpace,
  to: CoordinateSpace,
): TransformBridge | null {
  for (const entry of TRANSFORM_REGISTRY) {
    if (entry.from === from && entry.to === to) return entry;
  }
  return null;
}

const DEFAULT_CAMERA_DISTANCE = 12;

export function transformVector(
  v: Vector3,
  from: CoordinateSpace,
  to: CoordinateSpace,
  ctx: TransformContext,
): Vector3 {
  const bridge = getTransformBridge(from, to);
  if (!bridge) {
    throw new Error(
      `[prism/transforms] no documented hop for ${from} → ${to} (INV-22: refusing to collapse coordinate systems).`,
    );
  }

  switch (bridge.kind) {
    case 'identity':
    case 'camera-lock':
      // camera-lock is a renderer-side weld; numerically a pass-through.
      return { x: v.x, y: v.y, z: v.z };

    case 'runtime-bridge': {
      const hub = ctx.hubWorldPosition ?? { x: 0, y: 0, z: 0 };
      if (from === 'universe' && to === 'hub-scene') {
        return { x: v.x - hub.x, y: v.y - hub.y, z: v.z - hub.z };
      }
      // hub-scene → universe
      return { x: v.x + hub.x, y: v.y + hub.y, z: v.z + hub.z };
    }

    case 'projection': {
      // hub-scene → viewport-composition: documented single-axis projection.
      const d = ctx.cameraDistance ?? DEFAULT_CAMERA_DISTANCE;
      const denom = d - v.z;
      if (denom === 0) {
        throw new Error(
          '[prism/transforms] projection denominator is zero (z coincides with camera plane).',
        );
      }
      return { x: v.x / denom, y: v.y / denom, z: v.z };
    }

    case 'unprojection': {
      // viewport-composition → hub-scene: inverse of `projection`. v.z is the
      // depth carried from the projection; multiply x/y by (d - z) to invert.
      const d = ctx.cameraDistance ?? DEFAULT_CAMERA_DISTANCE;
      const denom = d - v.z;
      return { x: v.x * denom, y: v.y * denom, z: v.z };
    }

    case 'scroll-bind': {
      const p = ctx.scrollProgress ?? 0;
      if (from === 'scroll-timeline') {
        // scroll-timeline → viewport-composition: the timeline's y dimension
        // scales by the current scroll progress; x/z echo.
        return { x: v.x, y: v.y * p, z: v.z };
      }
      // viewport-composition → scroll-timeline: inverse of above. When
      // progress is 0 the inverse is undefined; we collapse to the source y
      // (renderer treats this as the "start" frame).
      return { x: v.x, y: p === 0 ? v.y : v.y / p, z: v.z };
    }

    case 'composition':
      // Reserved for future multi-hop composition (Phase 10 preview-app
      // aggregation). Echo for now; the registry has no entries of this
      // kind so this case is unreachable today.
      return { x: v.x, y: v.y, z: v.z };
  }
}

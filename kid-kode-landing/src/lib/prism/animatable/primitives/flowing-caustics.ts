// flowing-caustics — a directional river of caustic light streams across the
// surface, the bright net sliding steadily downstream. HARD / GPU primitive.
// Swaps the host plane's material for a MeshStandardNodeMaterial whose
// emissiveNode is a cellular (Voronoi-distance) light net ADVECTED along a fixed
// flow direction: the whole sample point is offset by flowDir * uTime * speed so
// the entire net translates downstream (a streaming river), and the sample uv is
// scaled anisotropically by `streak` along the flow axis so cells stretch into
// long streaky filaments. seek() advances a time uniform → the net flows.
// DISTINCT from pool-caustics (two crawling layers that wobble in place, static
// drift) — this one is a single net translating coherently in one direction.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, fract, dot, floor, min, max, pow } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 3, max: 14, step: 0.1, default: 7 },
  { id: 'streak', label: 'Streak', type: 'knob', min: 1, max: 4, step: 0.05, default: 2 },
] as const;

// Fixed downstream flow direction in uv space (normalized-ish diagonal river).
const FLOW_X = 0.6;
const FLOW_Y = 0.8;

export const flowingCausticsPrimitive: PrimitiveDefinition = {
  name: 'flowing-caustics',
  label: 'Flowing Caustics',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A directional river of caustic light streams across the surface, the bright net sliding steadily downstream.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'flowing-caustics', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uScale = uniform(num(params.scale, 7));
      const uStreak = uniform(num(params.streak, 2));

      // ── Voronoi-distance cellular field built from TSL nodes ─────────────
      // Cast lattice / sample coords to dodge strict TSL Var/Join typing
      // (mirrors pool-caustics.ts hash + caustics.ts node-assignment casts).
      type V2 = ReturnType<typeof vec2>;

      // hash2: a deterministic vec2 feature-point offset per integer cell.
      const hash2 = (g: V2) =>
        fract(
          vec2(
            sin(dot(g, vec2(127.1, 311.7))),
            sin(dot(g, vec2(269.5, 183.3))),
          ).mul(43758.5453),
        );

      // voronoiDist: min distance from p to the nearest jittered feature point
      // across the 3x3 neighborhood of integer cells around p. The feature
      // points have a tiny static jitter only — the STREAMING comes entirely
      // from translating `p` by the flow offset before this call, so the whole
      // net advects coherently downstream rather than wobbling in place.
      const voronoiDist = (p: V2) => {
        const ip = floor(p);
        const fp = fract(p);
        // start with a large distance; min() it down across the 9 neighbors.
        // Opaque node type so reassigning min(...) (a wider Node) type-checks —
        // mirrors pool-caustics.ts TNode discipline (the `let x: any` fix).
        let dMin: any = float(8);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cell = vec2(ox, oy);
            const feat = hash2(ip.add(cell) as unknown as V2);
            const diff = cell.add(feat).sub(fp);
            const d = dot(diff as unknown as V2, diff as unknown as V2); // squared dist
            dMin = min(dMin, d);
          }
        }
        // sqrt of squared distance → euclidean cell distance.
        return pow(dMin, float(0.5));
      };

      const u = uv();
      // Advection offset: the entire sample point slides along the fixed flow
      // direction over time → the net streams downstream (directional river).
      const adv = uTime.mul(uSpeed);
      const flowOff = vec2(FLOW_X, FLOW_Y).mul(adv);

      // Anisotropic scale: stretch cells ALONG the flow axis by `streak` so the
      // net reads as long streaky filaments running downstream. We scale the
      // cross-flow axis (x here, roughly perpendicular) up and keep the flow
      // axis compressed so a sample sweeps through more cells across-stream than
      // along-stream → elongated cells in the flow direction.
      const sx = u.x.mul(uScale).mul(uStreak);
      const sy = u.y.mul(uScale).div(uStreak);
      const p = vec2(sx, sy).add(flowOff.mul(uScale));

      const dist = voronoiDist(p as unknown as V2);
      // Invert + sharpen the distance into a bright net of cells.
      const cells = pow(max(float(1).sub(dist), float(0)), float(4));

      // Sunlit river tint: cool aqua base, bright white-gold streaming net.
      const aqua = vec3(0.3, 0.6, 0.72);
      const gold = vec3(1.0, 0.95, 0.8);
      const colorNode = aqua.add(gold.mul(cells));
      const emissiveNode = gold.mul(cells);

      const mat = new MeshStandardNodeMaterial({
        transparent: true,
        roughness: 0.5,
        metalness: 0.0,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles into host scratch space (contract: userData is
      // "uniform handles, etc."). Their `.value` is CPU-observable for tests.
      target.userData.flowingCaustics = { uTime, uSpeed, uScale, uStreak };

      return {
        // Looping/stateful streaming light net: continuous, never settles.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uScale.value = num(params.scale, 7);
          uStreak.value = num(params.streak, 2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'scale') uScale.value = num(value, 7);
          else if (id === 'streak') uStreak.value = num(value, 2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

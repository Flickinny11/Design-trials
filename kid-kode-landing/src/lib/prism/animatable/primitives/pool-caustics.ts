// pool-caustics — a bright caustic light-net dances on a sunlit pool floor.
// HARD / GPU primitive. Swaps the host plane's material for a
// MeshStandardNodeMaterial whose colorNode/emissiveNode paint a sharp cellular
// (Voronoi-distance) light net: for each of two layers we find the distance to
// the nearest hashed feature point in a 3x3 cell neighborhood, invert and
// sharpen it with pow into bright interfering cells, and let the two layers flow
// in different directions so the net crawls and interferes. seek() advances a
// time uniform; onParamChange() updates the live uniforms. DISTINCT from
// caustics-ripple (ripple-distort) and underwater-caustics — this is the sharp
// pool-floor light net, not a soft ripple field.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, fract, dot, floor, min, max, pow } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 3, max: 14, step: 0.1, default: 7 },
  { id: 'sharpness', label: 'Sharpness', type: 'knob', min: 1, max: 6, step: 0.1, default: 3 },
] as const;

export const poolCausticsPrimitive: PrimitiveDefinition = {
  name: 'pool-caustics',
  label: 'Pool Caustics',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Bright caustic light-net dances on a pool floor — sharp interfering light cells crawling across the plane.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pool-caustics', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uScale = uniform(num(params.scale, 7));
      const uSharp = uniform(num(params.sharpness, 3));

      // ── Voronoi-distance cellular field built from TSL nodes ─────────────
      // Cast lattice / sample coords to dodge strict TSL Var/Join typing
      // (mirrors iridescence.ts hash + caustics.ts node-assignment casts).
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
      // across the 3x3 neighborhood of integer cells around p. Returns the cell
      // distance in [0,~1]. Feature points wobble over time (flow) so the net
      // crawls and the cells morph rather than sit still.
      const voronoiDist = (p: V2, flow: V2) => {
        const ip = floor(p);
        const fp = fract(p);
        // start with a large distance; min() it down across the 9 neighbors.
        // Opaque node type so reassigning min(...) (a wider Node) type-checks —
        // mirrors foam.ts / clouds.ts TNode discipline.
        let dMin: any = float(8);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cell = vec2(ox, oy);
            const feat = hash2(ip.add(cell) as unknown as V2);
            // animate the feature point inside its cell with a flowing wobble.
            const wob = vec2(
              sin(feat.x.mul(6.2831853).add(flow.x)).mul(0.5).add(0.5),
              cos(feat.y.mul(6.2831853).add(flow.y)).mul(0.5).add(0.5),
            );
            const diff = cell.add(wob).sub(fp);
            const d = dot(diff as unknown as V2, diff as unknown as V2); // squared dist
            dMin = min(dMin, d);
          }
        }
        // sqrt of squared distance → euclidean cell distance.
        return pow(dMin, float(0.5));
      };

      const u = uv();
      const t = uTime.mul(uSpeed);

      // Layer A: scaled uv, flowing one direction.
      const pA = vec2(u.x, u.y).mul(uScale);
      const flowA = vec2(t, t.mul(0.7));
      const dA = voronoiDist(pA as unknown as V2, flowA as unknown as V2);
      const cA = pow(max(float(1).sub(dA), float(0)), uSharp);

      // Layer B: slightly different scale + offset, flowing a different
      // direction so the two nets interfere and crawl across each other.
      const pB = vec2(u.x.add(0.37), u.y.sub(0.21)).mul(uScale.mul(1.27));
      const flowB = vec2(t.mul(-0.8).add(2.3), t.mul(1.1).sub(1.7));
      const dB = voronoiDist(pB as unknown as V2, flowB as unknown as V2);
      const cB = pow(max(float(1).sub(dB), float(0)), uSharp);

      // Sum the two layers → the bright light net. Sunlit tint: warm white-gold
      // core fading to a pale aqua in the dimmer regions.
      const net = cA.add(cB);
      const gold = vec3(1.0, 0.96, 0.78);
      const aqua = vec3(0.32, 0.62, 0.7);
      const lit = aqua.add(gold.mul(net));

      const colorNode = lit;
      const emissiveNode = gold.mul(net).mul(0.85);

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
      target.userData.poolCaustics = { uTime, uSpeed, uScale, uSharp };

      return {
        // Looping/stateful crawling light net: continuous, no settle.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uScale.value = num(params.scale, 7);
          uSharp.value = num(params.sharpness, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'scale') uScale.value = num(value, 7);
          else if (id === 'sharpness') uSharp.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

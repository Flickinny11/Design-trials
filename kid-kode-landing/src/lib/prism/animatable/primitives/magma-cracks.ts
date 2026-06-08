// magma-cracks — cooled dark rock crust veined with glowing molten cracks.
// HARD / GPU primitive (category: volumetric). Swaps the host plane's material
// for a MeshBasicNodeMaterial whose colorNode builds a cellular crack network:
// a Voronoi edge-distance field over the scaled uv (with a slow time drift)
// gives thin bright veins via pow(1 - edgeDist, edgePow); a heat pulse
// 0.7 + 0.3*sin(uTime*pulse + uv.x*3) makes the veins throb; colorNode mixes
// dark rock with a hot magma palette by crack*heat. opacityNode = 1 (opaque
// crust). seek() advances uTime; onParamChange() updates live uniforms.
// DISTINCT — a glowing magma vein network on dark crust, not a soft light net.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  cos,
  fract,
  dot,
  floor,
  min,
  max,
  pow,
  mix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'scale', label: 'Scale', type: 'knob', min: 2, max: 10, step: 0.1, default: 5 },
  { id: 'pulse', label: 'Pulse', type: 'knob', min: 0.1, max: 4, step: 0.05, default: 1.4 },
  { id: 'heat', label: 'Heat', type: 'knob', min: 0.3, max: 3, step: 0.05, default: 1.2 },
] as const;

export const magmaCracksPrimitive: PrimitiveDefinition = {
  name: 'magma-cracks',
  label: 'Magma Cracks',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Cooled rock veined with glowing magma — a dark crust split by molten cracks that pulse hot orange and shift.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'magma-cracks', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uScale = uniform(num(params.scale, 5));
      const uPulse = uniform(num(params.pulse, 1.4));
      const uHeat = uniform(num(params.heat, 1.2));

      // ── Voronoi EDGE-distance cellular field (the crack network) ──────────
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

      // crackEdge: a Voronoi cell-border field. We collect the two SMALLEST
      // feature-point distances (F1 = nearest, F2 = second-nearest) across the
      // 3x3 neighborhood; their difference (F2 - F1) is ~0 right on a cell
      // border and grows toward the cell interior — exactly where cracks live.
      // This needs only running min() accumulators (no select/lessThan), so it
      // stays within the strict-tsc-safe node vocabulary. Opaque node types so
      // reassigning a wider Node (min/sub) type-checks — mirrors pool-caustics.
      const crackEdge = (p: V2, drift: V2) => {
        const ip = floor(p);
        const fp = fract(p);

        let f1: any = float(8); // nearest squared distance
        let f2: any = float(8); // second-nearest squared distance
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cell = vec2(ox, oy);
            const feat = hash2(ip.add(cell) as unknown as V2);
            // slow drift of feature points so the cracks shift over time.
            const wob = vec2(
              sin(feat.x.mul(6.2831853).add(drift.x)).mul(0.5).add(0.5),
              cos(feat.y.mul(6.2831853).add(drift.y)).mul(0.5).add(0.5),
            );
            const ptOff = cell.add(wob).sub(fp);
            const d = dot(ptOff as unknown as V2, ptOff as unknown as V2);
            // If d beats f1, it becomes the new f1 and the old f1 falls to f2.
            // Branchless: f2 = min(f2, max(d, f1)); f1 = min(f1, d).
            f2 = min(f2, max(d, f1));
            f1 = min(f1, d);
          }
        }
        // Euclidean-ish border distance: (sqrt(f2) - sqrt(f1)).
        return pow(f2, float(0.5)).sub(pow(f1, float(0.5)));
      };

      const u = uv();
      // slowDrift(uTime): a gentle drift so the crack network shifts.
      const drift = vec2(uTime.mul(0.18), uTime.mul(0.13));
      const p = vec2(u.x, u.y).mul(uScale);
      const edgeDist = crackEdge(p as unknown as V2, drift as unknown as V2);

      // crack = pow(1 - edgeDist, edgePow): thin bright veins where edgeDist→0.
      const edgePow = float(7);
      const crack = pow(max(float(1).sub(edgeDist), float(0)), edgePow);

      // heat pulse: 0.7 + 0.3*sin(uTime*pulse + uv.x*3), scaled by uHeat.
      const heat = float(0.7).add(sin(uTime.mul(uPulse).add(u.x.mul(3))).mul(0.3)).mul(uHeat);

      // colorNode = mix(dark rock, hot magma palette, crack*heat). The magma
      // palette ramps deep red → orange → hot yellow with the vein strength.
      const glow = crack.mul(heat);
      const rock = vec3(0.05, 0.035, 0.03);
      const magmaDeep = vec3(0.85, 0.18, 0.04);
      const magmaHot = vec3(1.0, 0.78, 0.28);
      const magma = mix(magmaDeep, magmaHot, max(min(glow, float(1)), float(0)));
      const colorNode = mix(rock, magma, max(min(glow, float(1)), float(0)));

      const mat = new MeshBasicNodeMaterial({ transparent: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = float(1);

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles into host scratch space (contract: userData is
      // "uniform handles, etc."). Their `.value` is CPU-observable for tests.
      target.userData.magmaCracks = { uTime, uScale, uPulse, uHeat };

      return {
        // Looping/stateful glowing crust: continuous pulse, no settle.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uScale.value = num(params.scale, 5);
          uPulse.value = num(params.pulse, 1.4);
          uHeat.value = num(params.heat, 1.2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'scale') uScale.value = num(value, 5);
          else if (id === 'pulse') uPulse.value = num(value, 1.4);
          else if (id === 'heat') uHeat.value = num(value, 1.2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

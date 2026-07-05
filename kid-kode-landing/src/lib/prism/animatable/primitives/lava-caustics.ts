// lava-caustics — glowing molten caustic cells pulse in hot orange and red,
// like light churning through lava. HARD / GPU primitive. Swaps the host plane's
// material for a MeshStandardNodeMaterial whose emissiveNode paints hot caustic
// cells: for each of two layers we find the distance to the nearest hashed,
// time-flowing feature point in a 3x3 cell neighborhood, invert + sharpen it
// with pow into bright cell cores, sum the two layers, and map the resulting
// heat through a blackbody-ish palette (dark red -> orange -> yellow hot cores)
// via mix. The hottest cores pulse with uTime. seek() advances a time uniform;
// onParamChange() updates the live uniforms. DISTINCT from pool-caustics (a cool
// white/aqua light net) — this is hot molten cells in a blackbody ramp.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, fract, dot, floor, min, max, mix, pow } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 3, max: 14, step: 0.1, default: 7 },
  { id: 'heat', label: 'Heat', type: 'knob', min: 0.3, max: 2.5, step: 0.05, default: 1 },
] as const;

export const lavaCausticsPrimitive: PrimitiveDefinition = {
  name: 'lava-caustics',
  label: 'Lava Caustics',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Glowing molten caustic cells pulse in hot orange and red, like light through churning lava.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'lava-caustics', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uScale = uniform(num(params.scale, 7));
      const uHeat = uniform(num(params.heat, 1));

      // ── Voronoi-distance cellular field built from TSL nodes ─────────────
      // Cast lattice / sample coords to dodge strict TSL Var/Join typing
      // (mirrors pool-caustics.ts + caustics.ts node-assignment casts).
      type V2 = ReturnType<typeof vec2>;

      // hash2: a deterministic vec2 feature-point offset per integer cell.
      const hash2 = (g: V2) =>
        fract(
          vec2(
            sin(dot(g, vec2(127.1, 311.7))),
            sin(dot(g, vec2(269.5, 183.3))),
          ).mul(43758.5453),
        );

      // voronoiDist: min distance from p to the nearest jittered, time-flowing
      // feature point across the 3x3 neighborhood of integer cells around p.
      // Feature points churn over time (flow) so the molten cells crawl + morph.
      const voronoiDist = (p: V2, flow: V2) => {
        const ip = floor(p);
        const fp = fract(p);
        // Start with a large distance; min() it down across the 9 neighbors.
        // Opaque (`any`) node type so reassigning min(...) (a wider Node) type-
        // checks under strict tsc — mirrors pool-caustics.ts / splat-reveal.ts.
        let dMin: any = float(8);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cell = vec2(ox, oy);
            const feat = hash2(ip.add(cell) as unknown as V2);
            // animate the feature point inside its cell with a churning wobble.
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
      const cA = pow(max(float(1).sub(dA), float(0)), float(2.4));

      // Layer B: slightly different scale + offset, flowing a different
      // direction so the molten cells interfere and churn across each other.
      const pB = vec2(u.x.add(0.41), u.y.sub(0.19)).mul(uScale.mul(1.31));
      const flowB = vec2(t.mul(-0.85).add(2.1), t.mul(1.15).sub(1.4));
      const dB = voronoiDist(pB as unknown as V2, flowB as unknown as V2);
      const cB = pow(max(float(1).sub(dB), float(0)), float(2.4));

      // Sum → raw heat, pulsed at the hottest cores so they breathe over time.
      const pulse = sin(uTime.mul(2.0)).mul(0.5).add(0.5).mul(0.35).add(0.65);
      const heat = cA.add(cB).mul(uHeat).mul(pulse);

      // ── Blackbody-ish palette: dark red → orange → yellow-white hot cores ──
      // Two mixes ramp the heat through molten colors. heat is clamped into the
      // mix factors so cool regions read dark-red and the hottest cells go to a
      // pale yellow-white core.
      const dark = vec3(0.18, 0.0, 0.0); // smoldering dark red
      const ember = vec3(0.85, 0.16, 0.02); // glowing red-orange
      const hot = vec3(1.0, 0.92, 0.5); // yellow-white hot core

      const k1 = max(min(heat, float(1)), float(0));
      const k2 = max(min(heat.sub(1.0), float(1)), float(0));
      const ramp = mix(dark, ember, k1);
      const molten = mix(ramp, hot, k2);

      // Emissive carries the glow so the molten cells read hot even without an
      // env light; the base color is the smoldering crust.
      const colorNode = molten.mul(0.4);
      const emissiveNode = molten;

      const mat = new MeshStandardNodeMaterial({
        transparent: true,
        roughness: 0.6,
        metalness: 0.0,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles into host scratch space (contract: userData is
      // "uniform handles, etc."). Their `.value` is CPU-observable for tests.
      target.userData.lavaCaustics = { uTime, uSpeed, uScale, uHeat };

      return {
        // Looping/stateful churning molten field: continuous, no settle.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uScale.value = num(params.scale, 7);
          uHeat.value = num(params.heat, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'scale') uScale.value = num(value, 7);
          else if (id === 'heat') uHeat.value = num(value, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

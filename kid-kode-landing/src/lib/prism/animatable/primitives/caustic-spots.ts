// caustic-spots — a few bright wandering caustic spots crawl across the floor
// like focused sunlight dancing through rippled water. HARD / GPU primitive.
// Swaps the host plane's material for a MeshStandardNodeMaterial whose
// emissiveNode/colorNode sum several drifting focused spots: each center
// c_k(uTime) = base_k + vec2(sin(uTime*sp_k), cos(uTime*sp_k*1.3))*0.2 wanders
// in a small loop; spot = sum pow(max(0, 1 - length(uv-c_k)/radius), sharp).
// Tinted sunlit warm-white. seek() advances a time uniform; onParamChange()
// updates the live uniforms. DISTINCT from pool-caustics (a full cellular light
// net) — this is a handful of wandering focused hot spots.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, length, max, pow } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'radius', label: 'Radius', type: 'knob', min: 0.05, max: 0.3, step: 0.005, default: 0.16 },
  { id: 'sharpness', label: 'Sharpness', type: 'knob', min: 1, max: 6, step: 0.1, default: 3 },
] as const;

// A handful of focused spots with distinct home positions + drift speeds, so
// the centers wander on different little loops (no two move together).
const SPOTS: ReadonlyArray<{ x: number; y: number; sp: number }> = [
  { x: 0.3, y: 0.32, sp: 0.9 },
  { x: 0.68, y: 0.28, sp: 1.3 },
  { x: 0.5, y: 0.62, sp: 0.7 },
  { x: 0.24, y: 0.7, sp: 1.6 },
  { x: 0.76, y: 0.66, sp: 1.1 },
];

export const causticSpotsPrimitive: PrimitiveDefinition = {
  name: 'caustic-spots',
  label: 'Caustic Spots',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Bright wandering caustic spots crawl across the floor like focused sunlight dancing through rippled water.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'caustic-spots', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uRadius = uniform(num(params.radius, 0.16));
      const uSharp = uniform(num(params.sharpness, 3));

      const u = uv();
      const t = uTime.mul(uSpeed);

      // Accumulate the focused spots. Annotate as `any` so reassigning a wider
      // TSL Node (add result) type-checks under strict tsc — mirrors the
      // pool-caustics.ts / splat-reveal.ts accumulator discipline.
      let spot: any = float(0);
      for (const s of SPOTS) {
        // wandering center: a small loop around the home position. The y-loop
        // runs at 1.3x so each spot traces an ellipse, not a circle.
        const cx = float(s.x).add(sin(t.mul(s.sp)).mul(0.2));
        const cy = float(s.y).add(cos(t.mul(s.sp * 1.3)).mul(0.2));
        const center = vec2(cx, cy);
        const d = length(u.sub(center));
        // focused falloff: 1 at the center, 0 past `radius`, sharpened by `sharp`.
        const falloff = max(float(0), float(1).sub(d.div(uRadius)));
        spot = spot.add(pow(falloff, uSharp));
      }

      // Sunlit warm-white tint: bright gold-white core riding on a faint warm
      // ambient so the floor reads as lit, not black between the spots.
      const warm = vec3(1.0, 0.94, 0.74);
      const ambient = vec3(0.06, 0.07, 0.09);
      const lit = ambient.add(warm.mul(spot));

      const mat = new MeshStandardNodeMaterial({
        transparent: true,
        roughness: 0.55,
        metalness: 0.0,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = lit;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = warm.mul(spot).mul(0.9);

      // Expose the live uniform handles so the host / tests can observe the
      // CPU-side animation state without reading GPU pixels.
      (mat.userData as Record<string, unknown>).uniforms = {
        uTime,
        uSpeed,
        uRadius,
        uSharp,
      };

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Looping/stateful effect: never settles — animate continuously across t.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uRadius.value = num(params.radius, 0.16);
          uSharp.value = num(params.sharpness, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'radius') uRadius.value = num(value, 0.16);
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

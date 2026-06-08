// fluted-glass — ribbed fluted glass like a shower door: vertical flutes
// (cylindrical ribs) that refract and smear highlights into vertical stripes.
// HARD / GPU primitive (glass). Swaps the host card panel's material for a
// transmissive MeshPhysicalNodeMaterial (transmission=1, thickness, low
// roughness, ior~1.5). Its normalNode encodes the flutes: the surface normal's
// x-component is perturbed by sin(uv.x * flutes * 2PI) * fluteDepth, so each
// rib acts like a tiny vertical cylinder lens and refraction bends horizontally,
// smearing whatever is behind it into vertical streaks. A faint uTime shimmer
// breathes the flute depth so the stripes glint. seek() advances uTime and reads
// knobs live; onParamChange() mirrors the uniforms. dispose() restores the
// swapped material and disposes the created one.
//
// DISTINCT from bevel-glass (refraction concentrated at the chamfered edges,
// clear center): fluted-glass refracts across the *whole* surface in repeating
// vertical ribs.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  float,
  sin,
  cos,
  max,
  mul,
  normalize,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const TWO_PI = Math.PI * 2;

const SCHEMA = [
  { id: 'flutes', label: 'Flutes', type: 'knob', min: 6, max: 40, step: 1, default: 16 },
  { id: 'fluteDepth', label: 'Flute Depth', type: 'knob', min: 0.1, max: 0.8, step: 0.01, default: 0.4 },
  { id: 'ior', label: 'IOR', type: 'fader', min: 1.2, max: 1.9, step: 0.01, default: 1.5 },
] as const;

export const flutedGlassPrimitive: PrimitiveDefinition = {
  name: 'fluted-glass',
  label: 'Fluted Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Ribbed fluted glass like a shower door — vertical flutes that refract and smear highlights into stripes.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fluted-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uFlutes = uniform(num(params.flutes, 16));
      const uFluteDepth = uniform(num(params.fluteDepth, 0.4));

      // Vertical flutes: the x-component of the surface normal is perturbed by a
      // sine wave running across uv.x, repeating `flutes` times. Each rib bows
      // the normal left then right (a cylindrical lens), so refraction bends
      // horizontally and smears the background into vertical stripes. The flutes
      // are constant along uv.y → the streaks run top-to-bottom. A faint uTime
      // shimmer breathes the depth so the ribs glint.
      const u = uv();
      const shimmer = sin(uTime.mul(1.6)).mul(0.5).add(0.5); // 0..1
      const depth = mul(uFluteDepth, float(1).add(shimmer.mul(0.18)));

      // phase across the surface: uv.x * flutes * 2PI
      const ribPhase = u.x.mul(uFlutes).mul(float(TWO_PI));
      // normal.x bows with the rib; a tiny cos term on uv.y keeps it from being
      // perfectly flat vertically (subtle waver), but flutes dominate in x.
      const nx = sin(ribPhase).mul(depth);
      const ny = cos(u.y.mul(float(Math.PI))).mul(depth).mul(0.05);
      // Keep a strong +Z so the panel still reads as a flat sheet between ribs.
      const nz = max(float(1).sub(depth.mul(0.5)), float(0.1));
      const flutedNormal = normalize(vec3(nx, ny, nz));

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        transmission: 1.0,
        thickness: 1.2,
        roughness: 0.06,
        metalness: 0.0,
        ior: clamp(num(params.ior, 1.5), 1.2, 1.9),
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.3,
      });
      (mat as unknown as { normalNode: unknown }).normalNode = flutedNormal;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles to the shared scratch space so the host (and
      // tests) can observe the live animation state without reaching the TSL graph.
      target.userData.flutedGlass = { uTime, uFlutes, uFluteDepth };

      const sync = () => {
        uFlutes.value = clamp(num(params.flutes, 16), 6, 40);
        uFluteDepth.value = clamp(num(params.fluteDepth, 0.4), 0.1, 0.8);
        // Keep the material scalar (fallback when nodes are unsupported) live.
        mat.ior = clamp(num(params.ior, 1.5), 1.2, 1.9);
      };

      return {
        // Continuous shimmer loop → Infinity (purely stateful, per contract).
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          sync();
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'flutes') uFlutes.value = clamp(num(value, 16), 6, 40);
          else if (id === 'fluteDepth') uFluteDepth.value = clamp(num(value, 0.4), 0.1, 0.8);
          else if (id === 'ior') mat.ior = clamp(num(value, 1.5), 1.2, 1.9);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

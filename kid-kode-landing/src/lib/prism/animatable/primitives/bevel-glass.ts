// bevel-glass — a thick beveled-edge glass panel: chunky refraction concentrated
// at the chamfered borders with a clear center. HARD / GPU primitive (glass).
// Swaps the host card panel's material for a transmissive MeshPhysicalNodeMaterial
// (transmission=1, high thickness, low roughness). Its normalNode is a *beveled*
// normal: in the flat center the surface normal points straight out (+Z), but
// near the uv borders the normal is pushed outward toward the nearest edge so
// refraction concentrates at the chamfer — distinct from frosted (roughness
// sweep), liquid (flowing metaball lobes), and crystal glass. A faint uTime
// shimmer breathes the bevel width + thickness so the refractive rim glints.
// seek() advances uTime and reads knobs live; onParamChange() mirrors uniforms.
// dispose() restores the swapped material and disposes the created one.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  float,
  abs,
  min,
  max,
  sub,
  sin,
  smoothstep,
  normalize,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'bevel', label: 'Bevel', type: 'knob', min: 0.05, max: 0.4, step: 0.01, default: 0.18 },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.3, max: 3, step: 0.05, default: 1.4 },
  { id: 'ior', label: 'IOR', type: 'fader', min: 1.2, max: 1.9, step: 0.01, default: 1.5 },
  { id: 'shimmer', label: 'Shimmer', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

export const bevelGlassPrimitive: PrimitiveDefinition = {
  name: 'bevel-glass',
  label: 'Beveled Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A thick beveled-edge glass panel — chunky refraction concentrated at chamfered borders with a clear center.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'bevel-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uBevel = uniform(num(params.bevel, 0.18));
      const uThickness = uniform(num(params.thickness, 1.4));
      const uShimmer = uniform(num(params.shimmer, 0.5));

      // Beveled normal: how close are we to the nearest uv border? distEdge is
      // the distance to the nearest of the 4 edges (0 at a border, 0.5 at center
      // in each axis). Inside the bevel width the surface "chamfers" — the normal
      // tilts outward toward that border; in the flat center it stays +Z.
      const u = uv();
      const dx = min(u.x, sub(float(1), u.x)); // dist to nearest vertical edge
      const dy = min(u.y, sub(float(1), u.y)); // dist to nearest horizontal edge
      const distEdge = min(dx, dy);

      // bevelRamp: 1 right at the border, ramping to 0 at the inner edge of the
      // bevel band — shimmer breathes the band width so the rim glints.
      const shimmerWave = sin(uTime.mul(2.0)).mul(0.5).add(0.5); // 0..1
      const bevelW = uBevel.mul(float(1).add(shimmerWave.mul(uShimmer).mul(0.5)));
      const bevelRamp = sub(float(1), smoothstep(float(0), bevelW, distEdge));

      // Outward tilt vector in the uv plane: which way does the chamfer face?
      // +x near the left edge, -x near the right edge (sign from u.x<0.5), and
      // similarly for y. We weight each axis by how much it owns the nearest edge
      // (the axis with the smaller distance dominates the chamfer direction).
      const sx = u.x.sub(0.5); // <0 left, >0 right
      const sy = u.y.sub(0.5); // <0 bottom, >0 top
      // axis ownership: 1 if this axis is the closer edge, else 0-ish (soft).
      const ownX = smoothstep(float(0), float(0.02), dy.sub(dx)); // dx<dy -> x owns
      const ownY = sub(float(1), ownX);

      // Tilt the normal outward (away from center) at the chamfer, scaled by the
      // bevel ramp. Magnitude bevelStrength makes the refraction "chunky".
      const tiltX = sx.mul(ownX).mul(bevelRamp).mul(float(2.4));
      const tiltY = sy.mul(ownY).mul(bevelRamp).mul(float(2.4));
      // Flat center keeps a strong +Z; the bevel reduces +Z so the normal leans.
      const nz = sub(float(1), bevelRamp.mul(0.7));
      const beveledNormal = normalize(vec3(tiltX, tiltY, max(nz, float(0.05))));

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        transmission: 1.0,
        thickness: clamp(num(params.thickness, 1.4), 0.3, 3),
        roughness: 0.05,
        metalness: 0.0,
        ior: clamp(num(params.ior, 1.5), 1.2, 1.9),
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.3,
      });
      (mat as unknown as { normalNode: unknown }).normalNode = beveledNormal;
      // Drive a subtle thickness shimmer on the GPU too via a thicknessNode so the
      // refraction depth breathes with uTime (visible only on a real GPU).
      const thicknessNode = uThickness.mul(
        float(1).add(abs(sin(uTime.mul(1.3))).mul(uShimmer).mul(0.25)),
      );
      (mat as unknown as { thicknessNode: unknown }).thicknessNode = thicknessNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles to the shared scratch space so the host (and
      // tests) can observe the live animation state without reaching the TSL graph.
      target.userData.bevelGlass = { uTime, uBevel, uThickness, uShimmer };

      const sync = () => {
        uBevel.value = clamp(num(params.bevel, 0.18), 0.05, 0.4);
        uThickness.value = clamp(num(params.thickness, 1.4), 0.3, 3);
        uShimmer.value = clamp(num(params.shimmer, 0.5), 0, 1);
        // Keep the material scalars (used as fallback when nodes are unsupported)
        // in sync with the live params.
        mat.thickness = uThickness.value;
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
          if (id === 'bevel') uBevel.value = clamp(num(value, 0.18), 0.05, 0.4);
          else if (id === 'thickness') {
            uThickness.value = clamp(num(value, 1.4), 0.3, 3);
            mat.thickness = uThickness.value;
          } else if (id === 'ior') mat.ior = clamp(num(value, 1.5), 1.2, 1.9);
          else if (id === 'shimmer') uShimmer.value = clamp(num(value, 0.5), 0, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

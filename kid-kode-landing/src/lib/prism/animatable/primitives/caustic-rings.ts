// caustic-rings — concentric caustic rings ripple outward from the plane's
// center, bright bands of focused light expanding like raindrop rings that fade
// with radius. HARD / GPU primitive. Swaps the host plane's material for a
// MeshStandardNodeMaterial whose emissiveNode is built from the radial distance:
//   r    = length(uv - 0.5)
//   band = pow(0.5 + 0.5*sin(r*ringFreq - uTime*speed), sharp) * exp(-r*falloff)
// so rings radiate outward (the -uTime*speed phase) and fade with radius. seek()
// advances the uTime uniform; onParamChange() updates the live uniforms. DISTINCT
// from caustics-ripple (distortion) and pool-caustics (Voronoi cells): these are
// concentric, expanding, sunlit caustic rings.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, pow, exp, length } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.4 },
  { id: 'ringFreq', label: 'Ring Freq', type: 'knob', min: 8, max: 40, step: 0.5, default: 22 },
  { id: 'sharpness', label: 'Sharpness', type: 'knob', min: 1, max: 6, step: 0.1, default: 3 },
] as const;

const FALLOFF = 3.2; // radial fade — rings dim as they expand outward

export const causticRingsPrimitive: PrimitiveDefinition = {
  name: 'caustic-rings',
  label: 'Caustic Rings',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Concentric caustic rings ripple outward from a center, bright bands of focused light expanding like raindrop rings.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'caustic-rings', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1.4));
      const uRingFreq = uniform(num(params.ringFreq, 22));
      const uSharp = uniform(num(params.sharpness, 3));

      // Sunlit tint — warm, focused light.
      const tint = new Color('#ffe6b0');

      // Radial distance from center, concentric expanding rings.
      const u = uv();
      const r = length(u.sub(0.5));
      // sin phase travels inward over time (-uTime*speed) so rings radiate out.
      const wave = float(0.5).add(
        float(0.5).mul(sin(r.mul(uRingFreq).sub(uTime.mul(uSpeed)))),
      );
      const band = pow(wave, uSharp).mul(exp(r.mul(-FALLOFF)));

      const emissiveNode = vec3(tint.r, tint.g, tint.b).mul(band).mul(2.4);

      const mat = new MeshStandardNodeMaterial({
        color: new Color('#10182e'),
        roughness: 0.4,
        metalness: 0.1,
        transparent: true,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1.4);
          uRingFreq.value = num(params.ringFreq, 22);
          uSharp.value = num(params.sharpness, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1.4);
          else if (id === 'ringFreq') uRingFreq.value = num(value, 22);
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

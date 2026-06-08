// velvet-sheen — a soft retroreflective velvet sheen brightens the surface's
// grazing edges, with a gentle drifting bloom. MEDIUM / TSL primitive. Swaps
// the host card's material for a MeshStandardNodeMaterial whose emissiveNode
// adds an inverse-fresnel sheen: pow(smoothstep(0,1, distFromCenter), power) is
// brightest at the grazing edges, gated by a slow drifting modulation
// (0.7 + 0.3*sin(uTime*speed + uv.x*2)) and a tint. Soft and low-contrast on
// purpose (premium fabric) — DISTINCT from a hard specular metallic sheen.
// seek() advances the time uniform; onParamChange() updates the live uniforms.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, pow, smoothstep, length } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.05, max: 1.5, step: 0.05, default: 0.35 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#3a2b52' },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'power', label: 'Edge Focus', type: 'knob', min: 1, max: 6, step: 0.1, default: 2.4 },
] as const;

export const velvetSheenPrimitive: PrimitiveDefinition = {
  name: 'velvet-sheen',
  label: 'Velvet Sheen',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A soft retroreflective velvet sheen brightens the surface’s grazing edges, with a gentle drifting bloom.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'velvet-sheen', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#3a2b52'));
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.35));
      const uIntensity = uniform(num(params.intensity, 1));
      const uPower = uniform(num(params.power, 2.4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Inverse-fresnel velvet sheen in uv-space: distance from the center is
      // largest at the grazing edges, so the sheen rides the rim. smoothstep
      // softens it, pow tightens the falloff. A slow drift keeps it alive
      // (0.7 + 0.3*sin(uTime*speed + uv.x*2)) — low-contrast, like brushed velvet.
      const u = uv();
      const centered = u.sub(0.5).mul(2.0); // -1..1 across the card
      const distFromCenter = length(centered);
      const sheen = pow(smoothstep(float(0), float(1), distFromCenter), uPower);
      const mod = float(0.7).add(
        float(0.3).mul(sin(uTime.mul(uSpeed).add(u.x.mul(2.0)))),
      );
      const sheenTint = vec3(uR, uG, uB);
      const emissiveNode = sheenTint.mul(sheen).mul(mod).mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({
        color: new Color('#1b2444'),
        roughness: 0.9,
        metalness: 0.0,
        transparent: true,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles on the host scratch space so the picker
      // (and tests) can observe the CPU-side animation state without a GPU.
      target.userData.velvetSheen = { uTime, uSpeed, uIntensity, uPower };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.35);
          uIntensity.value = num(params.intensity, 1);
          uPower.value = num(params.power, 2.4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.35);
          else if (id === 'intensity') uIntensity.value = num(value, 1);
          else if (id === 'power') uPower.value = num(value, 2.4);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

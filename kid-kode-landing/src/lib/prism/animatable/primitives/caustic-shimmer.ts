// caustic-shimmer — soft refracted light caustics shimmer over the card surface,
// like sunlight through water dancing on a wall. HARD / GPU primitive.
//
// Swaps the host card's panel material for a MeshStandardNodeMaterial whose
// emissiveNode adds a cheap moving interference caustic: three offset sines of
// the scaled uv (two axes + a diagonal) drift in opposite directions across a
// uTime uniform, are summed, abs'd, and sharpened with pow, then scaled by a
// tint colour and an intensity. This is a soft ADDITIVE shimmer on top of the
// lit surface — distinct from caustics-ripple/underwater-caustics which distort
// or overlay a plane. seek() advances uTime; onParamChange() updates uniforms.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, abs, pow } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 4, max: 16, step: 0.1, default: 8 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'sharpness', label: 'Sharpness', type: 'knob', min: 1, max: 5, step: 0.1, default: 2 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#cfe8ff' },
] as const;

export const causticShimmerPrimitive: PrimitiveDefinition = {
  name: 'caustic-shimmer',
  label: 'Caustic Shimmer',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Soft refracted light caustics shimmer over the card surface, like sunlight through water dancing on a wall.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'caustic-shimmer', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#cfe8ff'));
      const uTime = uniform(0);
      const uScale = uniform(num(params.scale, 8));
      const uIntensity = uniform(num(params.intensity, 1));
      const uSharp = uniform(num(params.sharpness, 2));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Cheap moving interference caustic over the card surface.
      // pattern = pow(abs(sin(uv.x*f + t) + sin(uv.y*f - t*1.3)
      //                    + sin((uv.x+uv.y)*f*0.7 + t*0.6)), sharp)
      const u = uv();
      const f = uScale;
      const t = uTime;
      const wx = sin(u.x.mul(f).add(t));
      const wy = sin(u.y.mul(f).sub(t.mul(1.3)));
      const wd = sin(u.x.add(u.y).mul(f.mul(0.7)).add(t.mul(0.6)));
      const interference = abs(wx.add(wy).add(wd));
      const caustic = pow(interference, uSharp).mul(uIntensity);

      const emissiveNode = vec3(uR, uG, uB).mul(caustic);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles in the host scratch space (contract userData)
      // so the picker/host (and tests) can observe what seek advances.
      target.userData.causticShimmer = {
        uTime,
        uScale,
        uIntensity,
        uSharp,
      };

      const applyLive = () => {
        uScale.value = num(params.scale, 8);
        uIntensity.value = num(params.intensity, 1);
        uSharp.value = num(params.sharpness, 2);
      };

      return {
        // Looping/stateful shimmer — runs continuously across the driver clock.
        duration: () => Infinity,
        seek: (tt) => {
          const speed = num(params.speed, 1);
          uTime.value = tt * speed;
          // Read params live so control changes apply without a rebuild.
          applyLive();
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'scale') uScale.value = num(value, 8);
          else if (id === 'intensity') uIntensity.value = num(value, 1);
          else if (id === 'sharpness') uSharp.value = num(value, 2);
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

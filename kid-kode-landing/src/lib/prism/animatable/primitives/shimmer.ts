// shimmer — a moving diagonal specular sheen across the card surface.
// REFERENCE primitive (medium / GPU). Template for TSL-shader catalog
// primitives: swap the host subject's material for a node material driven by
// uniforms; seek() advances a time uniform; onParamChange() updates uniforms.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3 } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'cycle', label: 'Cycle', type: 'fader', min: 0.6, max: 6, step: 0.1, default: 2.4, unit: 's' },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 1.8 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.9 },
  { id: 'sharpness', label: 'Sharpness', type: 'knob', min: 1, max: 32, step: 1, default: 10 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#5d8bff' },
] as const;

export const shimmerPrimitive: PrimitiveDefinition = {
  name: 'shimmer',
  label: 'Shimmer',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'A moving diagonal light sheen sweeps across the surface; speed and sharpness tunable.',
  create: defineAnimatable(
    { name: 'shimmer', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#5d8bff'));
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1.8));
      const uIntensity = uniform(num(params.intensity, 0.9));
      const uSharp = uniform(num(params.sharpness, 10));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Moving diagonal band → sharp highlight → added over the tint.
      const u = uv();
      const band = u.x.add(u.y).mul(2.0).sub(uTime.mul(uSpeed));
      const sheen = band.sin().mul(0.5).add(0.5).pow(uSharp).mul(uIntensity);
      const colorNode = vec3(uR, uG, uB).add(vec3(1, 1, 1).mul(sheen));

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => num(params.cycle, 2.4),
        seek: (t) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1.8);
          else if (id === 'intensity') uIntensity.value = num(value, 0.9);
          else if (id === 'sharpness') uSharp.value = num(value, 10);
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

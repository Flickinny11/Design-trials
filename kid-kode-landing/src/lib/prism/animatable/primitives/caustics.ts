// caustics — a bright animated caustic web painted over the plane surface.
// HARD / GPU primitive. Swaps the host plane's material for a MeshBasicNode-
// Material whose colorNode layers sines of uv*scale offset by a time uniform,
// sharpened via pow, scaled by intensity, and tinted. seek() advances the time
// uniform; onParamChange() updates the live uniforms.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, pow, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#5ad4ff' },
] as const;

export const causticsPrimitive: PrimitiveDefinition = {
  name: 'caustics',
  label: 'Caustics',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A bright animated caustic web: layered sines of the scaled uv drift over time, sharpen into bright filaments, and tint the surface.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'caustics', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#5ad4ff'));
      const uTime = uniform(0);
      const uScale = uniform(num(params.scale, 5));
      const uSpeed = uniform(num(params.speed, 1));
      const uIntensity = uniform(num(params.intensity, 1));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Layered caustic web: scaled uv driven through offset sines along a few
      // directions; products of the bands form the interference filaments, then
      // sharpened with pow and scaled by intensity, finally tinted.
      const u = uv();
      const t = uTime.mul(uSpeed);
      const sx = u.x.mul(uScale);
      const sy = u.y.mul(uScale);

      const a = sin(sx.add(t)).mul(sin(sy.sub(t)));
      const b = sin(sx.sub(sy).mul(0.7).add(t.mul(1.3)));
      const web = max(a.add(b).mul(0.5), float(0));
      const sharp = pow(web, float(3)).mul(uIntensity);

      const colorNode = vec3(uR, uG, uB).mul(sharp);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => 4,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uScale.value = num(params.scale, 5);
          uSpeed.value = num(params.speed, 1);
          uIntensity.value = num(params.intensity, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'scale') uScale.value = num(value, 5);
          else if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'intensity') uIntensity.value = num(value, 1);
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

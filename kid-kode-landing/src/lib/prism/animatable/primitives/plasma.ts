// plasma — a classic plasma field of interfering sine waves cycling through
// electric colors. HARD / GPU / volumetric primitive. Swaps the host plane's
// material for a MeshBasicNodeMaterial whose colorNode sums four sine fields of
// the uv (two axis-aligned, one diagonal, one radial) all driven by a time
// uniform, then maps the summed field to a vivid cycling palette via phase-
// shifted sin-based RGB. seek() advances the time uniform; onParamChange()
// updates the live uniforms. Uniform handles are published on target.userData
// so a headless (no-GPU) test can observe the animation on CPU.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, length } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 2, max: 24, step: 0.5, default: 10 },
  { id: 'saturation', label: 'Saturation', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.8 },
] as const;

export const plasmaPrimitive: PrimitiveDefinition = {
  name: 'plasma',
  label: 'Plasma',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A classic plasma field of interfering sine waves cycling through electric colors.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'plasma', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uScale = uniform(num(params.scale, 10));
      const uSat = uniform(num(params.saturation, 0.8));

      // Publish uniform handles for the CPU-observable test (no GPU in headless).
      target.userData.plasma = { uTime, uSpeed, uScale, uSat };

      // Plasma field: interfering sine waves. uTime already folds in uSpeed.
      const u = uv();
      const t = uTime;
      const s = uScale;
      // axis frequencies derived from the single scale knob
      const a = s;
      const b = s.mul(1.3);
      const c = s.mul(0.7);
      const d = s.mul(1.6);

      const v = sin(u.x.mul(a).add(t))
        .add(sin(u.y.mul(b).add(t)))
        .add(sin(u.x.add(u.y).mul(c).add(t)))
        .add(sin(length(u.sub(vec2(0.5, 0.5))).mul(d).sub(t)));

      // Map v (~[-4,4]) to a vivid cycling palette via phase-shifted sin RGB.
      const PI = float(Math.PI);
      const rC = sin(v).mul(0.5).add(0.5);
      const gC = sin(v.add(PI.mul(2 / 3))).mul(0.5).add(0.5);
      const bC = sin(v.add(PI.mul(4 / 3))).mul(0.5).add(0.5);
      const vivid = vec3(rC, gC, bC);

      // Saturation: lerp between grayscale luminance and the vivid palette.
      const lum = rC.mul(0.299).add(gC.mul(0.587)).add(bC.mul(0.114));
      const gray = vec3(lum, lum, lum);
      const colorNode = gray.add(vivid.sub(gray).mul(uSat));

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const applyTime = (tt: number) => {
        // Fold speed into time so a faster speed cycles the field quicker.
        uTime.value = tt * num(params.speed, 1);
      };

      return {
        // Looping plasma field: purely stateful, no settle point.
        duration: () => Infinity,
        seek: (tt) => {
          applyTime(tt);
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uScale.value = num(params.scale, 10);
          uSat.value = clamp(num(params.saturation, 0.8), 0, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'scale') uScale.value = num(value, 10);
          else if (id === 'saturation') uSat.value = clamp(num(value, 0.8), 0, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.plasma;
          mat.dispose();
        },
      };
    },
  ),
};

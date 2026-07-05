// prism-spectrum — a rolling spectral rainbow refraction sweeps across the card
// surface: white light split into a moving prism spectrum. HARD / GPU primitive.
// Swaps the host card's panel material for a MeshStandardNodeMaterial whose
// emissiveNode adds a cos-palette spectrum mapped from a moving coordinate
//   s = fract(dot(uv,dir) * bands - uTime * speed)
// scaled by intensity. seek() advances the uTime uniform; live params + a
// uniform set let speed/bands/intensity tweak with no rebuild.
//
// DISTINCT from iridescence (fresnel oil-slick) / holographic: explicit moving
// spectral bands marching across the surface from a fixed direction.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, dot, fract, cos } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 4, step: 0.05, default: 1 },
  { id: 'bands', label: 'Bands', type: 'knob', min: 1, max: 6, step: 0.1, default: 3 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
] as const;

export const prismSpectrumPrimitive: PrimitiveDefinition = {
  name: 'prism-spectrum',
  label: 'Prism Spectrum',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A rolling spectral rainbow refraction sweeps across the surface — white light split into a moving prism spectrum.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'prism-spectrum', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uBands = uniform(num(params.bands, 3));
      const uIntensity = uniform(num(params.intensity, 1));

      // Moving 1D coordinate along a fixed diagonal direction:
      //   s = fract(dot(uv, dir) * bands - uTime * speed)
      const u = uv();
      const dir = vec2(float(0.8), float(0.6)); // normalized-ish diagonal sweep
      const s = fract(dot(u, dir).mul(uBands).sub(uTime.mul(uSpeed)));

      // Cosine palette hue->rgb: 0.5 + 0.5*cos(2π*(s + phase)) per channel.
      const TAU = float(6.283185307179586);
      const phase = vec3(float(0), float(0.33), float(0.67));
      const spectral = vec3(float(0.5))
        .add(vec3(float(0.5)).mul(cos(TAU.mul(vec3(s).add(phase)))));

      const emissiveNode = spectral.mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Stash uniform handles on the shared scratch space so the host (and
      // tests) can observe the driven CPU-side state.
      target.userData.prismSpectrumUniforms = { uTime, uSpeed, uBands, uIntensity };

      return {
        // Continuous, looping spectral march — purely stateful.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uBands.value = clamp(num(params.bands, 3), 1, 6);
          uIntensity.value = num(params.intensity, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'bands') uBands.value = clamp(num(value, 3), 1, 6);
          else if (id === 'intensity') uIntensity.value = num(value, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.prismSpectrumUniforms;
          mat.dispose();
        },
      };
    },
  ),
};

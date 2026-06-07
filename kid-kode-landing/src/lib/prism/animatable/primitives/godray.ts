// godray — volumetric light shafts radiating from a moving source point in uv.
// REFERENCE-style primitive (hard / GPU). Swaps the host plane's material for a
// MeshBasicNodeMaterial whose colorNode accumulates a handful of samples marched
// toward the light source, each weighted by `decay`, producing warm radial god
// rays. A time uniform rotates the source angle and pulses intensity; seek()
// advances it. Numeric controls update uniforms via onParamChange.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.2 },
  { id: 'decay', label: 'Decay', type: 'knob', min: 0.8, max: 1, step: 0.005, default: 0.95 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: 0, max: 360, step: 1, default: 45, unit: 'deg' },
] as const;

const DEG2RAD = Math.PI / 180;
const SAMPLES = 6;

export const godrayPrimitive: PrimitiveDefinition = {
  name: 'godray',
  label: 'Volumetric godray',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description: 'Warm volumetric light shafts radiate from a rotating source point, accumulated by marching samples weighted by decay.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'godray', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uIntensity = uniform(num(params.intensity, 1.2));
      const uDecay = uniform(num(params.decay, 0.95));
      const uDensity = uniform(num(params.density, 1));
      const uAngle = uniform(num(params.angleDeg, 45) * DEG2RAD);

      // Moving light source: orbit the base angle slowly with time, on a unit-ish
      // circle centered on the plane, plus a gentle radial breathing.
      const ang = uAngle.add(uTime.mul(0.6));
      const src = vec2(
        cos(ang).mul(0.32).add(0.5),
        sin(ang).mul(0.32).add(0.5),
      );

      const u = uv();
      // Vector from fragment toward the source; we march along it.
      const delta = src.sub(u).mul(uDensity.mul(float(1.0 / SAMPLES)));

      // Accumulate radial samples toward the source, weighting each by decay^i.
      // A soft radial falloff is sampled at each step (brighter near source).
      // TSL fluent nodes infer over-narrow types across reassignment, so these
      // accumulator locals are typed loosely (the runtime values are TSL nodes).
      /* eslint-disable @typescript-eslint/no-explicit-any */
      let illum: any = float(0);
      let coord: any = u;
      let weight: any = float(1);
      /* eslint-enable @typescript-eslint/no-explicit-any */
      for (let i = 0; i < SAMPLES; i++) {
        coord = coord.add(delta);
        const d = coord.sub(src).length();
        const shaft = float(1).sub(d.mul(1.6)).max(0);
        illum = illum.add(shaft.mul(weight));
        weight = weight.mul(uDecay);
      }
      // Pulse the overall intensity over time so the shafts breathe.
      const pulse = sin(uTime.mul(1.4)).mul(0.18).add(0.92);
      const energy = illum.mul(float(1.0 / SAMPLES)).mul(uIntensity).mul(pulse);

      // Warm tint: amber core fading to a deeper orange in the shoulders.
      const warmCore = vec3(1.0, 0.86, 0.55);
      const warmEdge = vec3(0.65, 0.32, 0.12);
      const tint = mix(warmEdge, warmCore, energy.clamp(0, 1));
      const colorNode = tint.mul(energy);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => 4,
        seek: (t) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'intensity') uIntensity.value = num(value, 1.2);
          else if (id === 'decay') uDecay.value = num(value, 0.95);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'angleDeg') uAngle.value = num(value, 45) * DEG2RAD;
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

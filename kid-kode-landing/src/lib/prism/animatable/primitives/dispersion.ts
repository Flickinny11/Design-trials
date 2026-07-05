// dispersion — chromatic dispersion on a transmissive glass sphere. HARD / GPU
// node-material primitive (companion to glass-refraction.ts + fresnel-glow.ts).
// Swaps the host sphere's material for a MeshPhysicalNodeMaterial configured for
// transmission, then builds a fresnel rim term and splits it into R/G/B fringes
// whose fresnel powers are offset by an animating uSpread uniform. As uSpread
// pulses (driven by uTime), the three color channels separate and re-converge,
// so the rim shifts through RGB fringes. seek() advances uTime; numeric reads in
// seek + onParamChange keep controls live. dispose() restores the prev material.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  vec3,
  float,
  normalView,
  positionViewDirection,
  oneMinus,
  pow,
  sin,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'spread', label: 'Spread', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.6 },
  { id: 'ior', label: 'IOR', type: 'knob', min: 1, max: 2.5, step: 0.01, default: 1.5 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.2 },
] as const;

export const dispersionPrimitive: PrimitiveDefinition = {
  name: 'dispersion',
  label: 'Dispersion',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    'Chromatic dispersion splits the fresnel rim of a glass sphere into shifting RGB fringes.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dispersion', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // uSpread drives the per-channel fresnel power offsets; it pulses over
      // time (uTime) so the RGB fringes breathe in and out of alignment.
      const uTime = uniform(0);
      const uSpread = uniform(num(params.spread, 1.6));

      // Base fresnel: facing ratio of view normal vs. view direction. oneMinus
      // brightens at grazing angles (the rim); abs() keeps both faces lit.
      const facing = tslMax(normalView.dot(positionViewDirection).abs(), float(0));
      const fresnel = oneMinus(facing);

      // Split the rim into three channels by offsetting the fresnel exponent
      // per channel. As uSpread grows, the powers diverge, separating R/G/B.
      const base = float(2);
      const rPow = base.sub(uSpread);
      const gPow = base;
      const bPow = base.add(uSpread);

      const rChan = pow(fresnel, tslMax(rPow, float(0.2)));
      const gChan = pow(fresnel, gPow);
      const bChan = pow(fresnel, bPow);

      const emissiveNode = vec3(rChan, gChan, bChan);

      const mat = new MeshPhysicalNodeMaterial();
      mat.transmission = 1;
      mat.ior = num(params.ior, 1.5);
      mat.thickness = 0.5;
      mat.roughness = 0.04;
      mat.metalness = 0;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Pulse uSpread around the base `spread` param so the fringes shift.
      // The live value is mirrored onto mat.userData.uSpread as a CPU-observable
      // handle (the uniform itself is a closure; tests read the material).
      const applySpread = (t: number) => {
        const sp = num(params.spread, 1.6);
        const speed = num(params.speed, 1.2);
        // sine in [0,1] modulates 0.4..1.0 of the configured spread.
        const pulse = Math.sin(t * speed) * 0.5 + 0.5;
        const v = sp * (0.4 + 0.6 * pulse);
        uSpread.value = v;
        mat.userData.uSpread = v;
      };
      applySpread(0);

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          mat.ior = num(params.ior, 1.5);
          applySpread(t);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'ior') mat.ior = num(value, 1.5);
          else if (id === 'spread') uSpread.value = num(value, 1.6);
          else if (id === 'speed') applySpread(uTime.value as number);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

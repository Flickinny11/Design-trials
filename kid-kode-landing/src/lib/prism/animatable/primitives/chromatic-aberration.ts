// chromatic-aberration — transmissive glass with strong chromatic aberration.
// HARD / GPU primitive. Swaps the host card's material for a
// MeshPhysicalNodeMaterial (three/webgpu) configured as clear glass:
// transmission=1, low roughness, thickness, ior. RGB channels split at the
// refracted edges into colored fringes via an additive emissiveNode rim that
// offsets R/G/B by a uDispersion uniform. The base ior + dispersion breathe
// subtly with uTime so the fringe shimmers. seek() advances uTime and reads
// params live; onParamChange() reflects structural ior/dispersion/thickness
// onto the live uniforms and the material's physical fields.
//
// Distinct from the existing UV-shear color-split look: this is a real
// physical-transmission material whose colored fringe comes from a per-channel
// Fresnel rim driven by a dispersion uniform.
//
// flagRealGpu: transmission/IBL refraction under-renders under headless
// swiftshader; the observable CPU state is the ior/dispersion uniform .value.

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  normalView,
  positionViewDirection,
  dot,
  abs,
  sub,
  clamp as tslClamp,
  pow,
  add,
  mul,
  vec3,
  float,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'ior', label: 'IOR', type: 'fader', min: 1.1, max: 2.0, step: 0.01, default: 1.5 },
  { id: 'dispersion', label: 'Fringe', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.1, max: 3, step: 0.05, default: 1.2 },
] as const;

export const chromaticAberrationPrimitive: PrimitiveDefinition = {
  name: 'chromatic-aberration',
  label: 'Chromatic Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Transmissive glass with strong chromatic aberration — RGB channels split at the refracted edges into colored fringes.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'chromatic-aberration', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const iorBase = clamp(num(params.ior, 1.5), 1.1, 2.0);
      const dispBase = clamp(num(params.dispersion, 0.6), 0, 1);
      const thickBase = clamp(num(params.thickness, 1.2), 0.1, 3);

      // Observable uniforms: ior + dispersion breathe with time; the test reads
      // these .value handles (CPU-observable; transmission itself is GPU-only).
      const uIor = uniform(iorBase);
      const uDispersion = uniform(dispBase);
      const uThickness = uniform(thickBase);
      const uTime = uniform(0);

      // Fresnel rim: bright at grazing edges where refraction splits channels.
      const fres = pow(
        tslClamp(sub(float(1), abs(dot(normalView, positionViewDirection))), float(0), float(1)),
        float(2.4),
      );
      // Per-channel offset: R pushed out, B pulled in, scaled by the dispersion
      // uniform — the RGB fringe at the refracted edge.
      const d = uDispersion;
      const rChan = mul(fres, add(float(1), mul(d, float(0.9))));
      const gChan = fres;
      const bChan = mul(fres, sub(float(1), mul(d, float(0.6))));
      const rim = mul(vec3(rChan, gChan, bChan), mul(d, float(1.6)));

      const mat = new MeshPhysicalNodeMaterial({
        color: new Color('#cfe3ff'),
        metalness: 0,
        roughness: 0.05,
        transmission: 1,
        thickness: thickBase,
        ior: iorBase,
        transparent: true,
      });
      // Additive RGB-split rim as the emissive contribution.
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = rim;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const applyPhysical = () => {
        mat.ior = uIor.value;
        mat.thickness = uThickness.value;
      };

      return {
        // Looping shimmer: continuous breathing of ior/dispersion across t.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          const ior0 = clamp(num(params.ior, 1.5), 1.1, 2.0);
          const disp0 = clamp(num(params.dispersion, 0.6), 0, 1);
          const thick0 = clamp(num(params.thickness, 1.2), 0.1, 3);
          // Subtle continuous breathing — distinct values across the timeline.
          uIor.value = ior0 + Math.sin(tt * 1.3) * 0.06;
          uDispersion.value = clamp(disp0 + Math.sin(tt * 0.9 + 1.2) * 0.18, 0, 1);
          uThickness.value = thick0;
          applyPhysical();
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'ior') {
            uIor.value = clamp(num(value, 1.5), 1.1, 2.0);
            mat.ior = uIor.value;
          } else if (id === 'dispersion') {
            uDispersion.value = clamp(num(value, 0.6), 0, 1);
          } else if (id === 'thickness') {
            uThickness.value = clamp(num(value, 1.2), 0.1, 3);
            mat.thickness = uThickness.value;
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

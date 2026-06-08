// crystal-ball — a large, steady clear crystal ball that magnifies and inverts
// what's behind it, with slow internal light play. HARD / GPU node-material
// primitive. Swaps the host sphere's material for a clear (untinted)
// MeshPhysicalNodeMaterial tuned for strong magnification: transmission=1,
// high thickness (controls magnify strength), roughness 0, ior ~1.5. A faint
// internal sparkle is added via a subtle emissiveNode — soft moving lobes of
// view-direction fresnel modulated by drifting sines of uTime — to read as
// internal reflections / light play. Unlike water-droplet (small, surface-
// tension wobble) this is a BIG, STEADY magnifier: no vertex displacement, the
// sphere does not deform. seek() advances uTime and reads knobs live;
// onParamChange() syncs material scalars + glow uniform. dispose() restores the
// swapped material and disposes the created one.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  vec3,
  float,
  sin,
  normalView,
  positionViewDirection,
  oneMinus,
  pow,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 1, max: 5, step: 0.1, default: 3 },
  { id: 'ior', label: 'IOR', type: 'fader', min: 1.3, max: 1.8, step: 0.01, default: 1.5 },
  { id: 'innerGlow', label: 'Inner glow', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.2 },
] as const;

export const crystalBallPrimitive: PrimitiveDefinition = {
  name: 'crystal-ball',
  label: 'Crystal Ball',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    "A large clear crystal ball that magnifies and inverts what's behind it, with slow internal light play.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'crystal-ball', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uGlow = uniform(num(params.innerGlow, 0.2));

      // Internal light play: a soft fresnel rim (brightens at grazing angles)
      // modulated by two drifting sines of uTime so the inner reflections seem
      // to swim slowly. Cool/clear white tint (no color cast — the ball stays
      // clear). Scaled by the live innerGlow uniform.
      const facing = tslMax(normalView.dot(positionViewDirection), float(0));
      const fresnel = oneMinus(facing);
      // Drifting reflection lobes: combine two slow sines into a 0..1 factor.
      const driftA = sin(uTime.mul(0.7)).mul(0.5).add(0.5);
      const driftB = sin(uTime.mul(0.37).add(2.1)).mul(0.5).add(0.5);
      const drift = driftA.mul(0.6).add(driftB.mul(0.4));
      const sparkle = pow(fresnel, float(3)).mul(drift).mul(uGlow);
      // Clear faint white internal light (no tint).
      const emissive = vec3(0.85, 0.9, 1.0).mul(sparkle);

      const mat = new MeshPhysicalNodeMaterial();
      mat.transmission = 1;
      mat.thickness = num(params.thickness, 3);
      mat.roughness = 0;
      mat.metalness = 0;
      mat.ior = num(params.ior, 1.5);
      mat.transparent = true;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the driven uniforms to the shared scratch space so the host (and
      // tests) can observe the live internal-light state without a real GPU.
      target.userData.crystalBall = { uTime, uGlow };

      return {
        // Continuous looping effect — the internal light play drifts forever.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read knobs live so control changes apply with no rebuild.
          uGlow.value = num(params.innerGlow, 0.2);
          // thickness + ior are material scalars, not node uniforms — keep synced.
          mat.thickness = num(params.thickness, 3);
          mat.ior = num(params.ior, 1.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'innerGlow') uGlow.value = num(value, 0.2);
          else if (id === 'thickness') mat.thickness = num(value, 3);
          else if (id === 'ior') mat.ior = num(value, 1.5);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

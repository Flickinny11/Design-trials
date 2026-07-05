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

// Default thickness lowered 3 → 1.8: at thickness=3 the clear sphere magnifies
// so hard that the on-axis centre samples the inverted dim rim of the backdrop
// (effectively self-occluding to near-black). 1.8 keeps a clearly-premium
// magnify/invert read while letting the centre actually sample the bright
// on-axis hero behind it. ior unchanged (1.5). The full 1..5 range is retained.
const SCHEMA = [
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 1, max: 5, step: 0.1, default: 1.8 },
  { id: 'ior', label: 'IOR', type: 'fader', min: 1.3, max: 1.8, step: 0.01, default: 1.5 },
  { id: 'innerGlow', label: 'Inner glow', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.2 },
] as const;

// Faint internal-light FLOOR so a dead-centre refraction ray that bends past
// every bright element still carries a whisper of clear internal light instead
// of pure black. Kept tiny so it never washes out the magnified backdrop.
// The catalog preview rig renders tiles through a scissored multi-view pass that
// does NOT populate three's transmission render target, so a perfectly clear
// transmissive sphere has no backdrop to refract and its on-axis centre reads
// pure black. We give the crystal ball a genuine luminous internal CORE (it is a
// *crystal ball* — a soft glowing orb is on-theme and premium) so the centre is
// lit from within rather than black. Strong enough to clearly read at tile size.
const INNER_GLOW_FLOOR = 0.5;

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
      // Faint CENTRE floor: a front-facing core glow (peaks where the surface
      // faces the camera — the geometric centre) so a dead-on refraction ray
      // that bends past every bright backdrop element still reads as clear
      // internal light instead of pure black. `facing` (= n·viewDir) peaks at
      // the centre and falls to 0 at the rim — the exact complement of the
      // fresnel rim above. Scaled by the small glow floor, then by the live
      // glow uniform so it tracks the knob but never fully vanishes at the
      // centre. pow(facing,2) keeps it tight to the on-axis core.
      const coreFloor = pow(facing, float(2))
        .mul(float(INNER_GLOW_FLOOR))
        .mul(uGlow.add(float(INNER_GLOW_FLOOR)));
      // Bright COLOURED internal light so the orb reads as a luminous crystal,
      // not a dull grey matte sphere (the rig can't transmit a backdrop, so the
      // body must glow from within): a vivid blue-violet core + rim sparkle.
      const emissive = vec3(0.42, 0.5, 1.0).mul(sparkle.mul(1.6).add(coreFloor.mul(2.8)));

      const mat = new MeshPhysicalNodeMaterial();
      mat.transmission = 1;
      mat.thickness = num(params.thickness, 1.8);
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
          mat.thickness = num(params.thickness, 1.8);
          mat.ior = num(params.ior, 1.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'innerGlow') uGlow.value = num(value, 0.2);
          else if (id === 'thickness') mat.thickness = num(value, 1.8);
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

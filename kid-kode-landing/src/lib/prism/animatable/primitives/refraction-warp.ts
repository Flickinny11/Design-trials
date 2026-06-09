// refraction-warp — the glass sphere's refraction warps and breathes, bending
// the environment behind it. HARD / GPU primitive. Swaps the host sphere's
// material for a transmissive MeshPhysicalNodeMaterial whose normalNode is
// perturbed by sin-based ripples over position/uv driven by a time uniform, so
// the refracted background warps. ior/thickness pulse with the same time
// uniform. seek() advances the time uniform and reads params live;
// onParamChange() updates the live uniforms structurally. dispose() restores
// the host's previous material.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  positionLocal,
  normalLocal,
  vec3,
  float,
  sin,
  add,
  normalize,
  normalView,
  positionViewDirection,
  pow,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'warp', label: 'Warp', type: 'knob', min: 0, max: 1.5, step: 0.01, default: 0.55 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.2 },
  { id: 'ior', label: 'IOR', type: 'knob', min: 1, max: 2.4, step: 0.01, default: 1.45 },
] as const;

export const refractionWarpPrimitive: PrimitiveDefinition = {
  name: 'refraction-warp',
  label: 'Refraction Warp',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    "The glass sphere's refraction warps and breathes, bending the environment behind it.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'refraction-warp', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uWarp = uniform(num(params.warp, 0.55));
      const uSpeed = uniform(num(params.speed, 1.2));
      const uIor = uniform(num(params.ior, 1.45));
      // Live-pulsing structural uniforms updated in seek (observable on CPU).
      const uThickness = uniform(0.6);
      const uIorLive = uniform(num(params.ior, 1.45));

      // Ripple field: layered sines over local position + uv driven by uTime.
      // Used to perturb the surface normal so the transmissive refraction warps.
      const t = uTime.mul(uSpeed);
      const u = uv();
      const p = positionLocal;
      const ripple = add(
        sin(p.x.mul(6.0).add(t)),
        sin(p.y.mul(5.0).sub(t.mul(1.3))),
        sin(u.x.mul(9.0).add(u.y.mul(7.0)).add(t.mul(0.8))),
      ).mul(uWarp).mul(0.18);

      // Perturb the base local normal by the ripple field, then re-normalize.
      const perturbed = normalize(
        add(normalLocal, vec3(ripple, ripple.mul(0.6), float(0.0))),
      );

      // Luminous internal CORE: the catalog preview rig renders tiles through a
      // scissored multi-view pass that does NOT populate three's transmission
      // render target, so a perfectly clear transmissive sphere has no backdrop
      // to refract and its on-axis centre reads pure black. We light the warping
      // glass from within via an emissiveNode. `facing` (= n·viewDir) peaks where
      // the surface faces the camera — the geometric centre — and falls to 0 at
      // the rim (the complement of the fresnel rim). pow(facing,2) keeps the glow
      // tight to the on-axis core so the centre glows softly instead of black,
      // while the rim still catches the warped env. Cool tint.
      const facing = tslMax(normalView.dot(positionViewDirection), float(0));
      // Bright saturated teal-blue core so it reads as luminous glass, not grey clay.
      const core = pow(facing, float(2)).mul(float(1.1));
      const emissive = vec3(0.35, 0.66, 1.0).mul(core);

      const mat = new MeshPhysicalNodeMaterial({ transparent: true });
      mat.transmission = 1.0;
      mat.roughness = 0.04;
      mat.metalness = 0.0;
      mat.thickness = 0.6;
      mat.ior = num(params.ior, 1.45);
      mat.envMapIntensity = 1.4;
      (mat as unknown as { normalNode: unknown }).normalNode = perturbed;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const applyPulse = (tt: number) => {
        // ior + thickness breathe with time (a slow pulse around the base).
        const base = num(params.ior, 1.45);
        const ph = Math.sin(tt * num(params.speed, 1.2) * 0.9);
        const ior = base + ph * 0.12;
        const thickness = 0.6 + Math.sin(tt * num(params.speed, 1.2) * 0.9 + 1.0) * 0.35;
        uIorLive.value = ior;
        uThickness.value = thickness;
        mat.ior = ior;
        mat.thickness = thickness;
      };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uWarp.value = num(params.warp, 0.55);
          uSpeed.value = num(params.speed, 1.2);
          uIor.value = num(params.ior, 1.45);
          applyPulse(tt);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'warp') uWarp.value = num(value, 0.55);
          else if (id === 'speed') uSpeed.value = num(value, 1.2);
          else if (id === 'ior') {
            uIor.value = num(value, 1.45);
            mat.ior = num(value, 1.45);
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

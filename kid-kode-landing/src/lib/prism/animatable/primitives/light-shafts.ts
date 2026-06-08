// light-shafts — radial god-ray shafts that fan out from a bright source point,
// shimmering as dust drifts through them. HARD / GPU / volumetric primitive.
//
// Distinct from godray.ts (parallel marched shafts): here the shafts are RADIAL.
// We compute the angle from a source point, run an animated noise around that
// angle to carve discrete rays, sharpen with pow, and multiply by a radial
// distance falloff. Warm light color in the shafts, soft dark ambient elsewhere
// (not pure black). seek() and onParamChange() advance/update the live uniforms.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, pow, atan, abs, fract, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'rays', label: 'Rays', type: 'knob', min: 3, max: 48, step: 1, default: 18 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2 },
  { id: 'sharp', label: 'Sharpness', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
] as const;

export const lightShaftsPrimitive: PrimitiveDefinition = {
  name: 'light-shafts',
  label: 'Light Shafts',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Radial god-ray shafts fan out from a bright point, shimmering as dust drifts through them.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'light-shafts', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRays = uniform(num(params.rays, 18));
      const uSpeed = uniform(num(params.speed, 1));
      const uSpread = uniform(num(params.spread, 2));
      const uSharp = uniform(num(params.sharp, 3));

      // Source point near the upper-center of the plane (uv space).
      const sx = float(0.5);
      const sy = float(0.82);

      const u = uv();
      const dx = u.x.sub(sx);
      const dy = u.y.sub(sy);

      // Angle of this fragment around the source point.
      const angle = atan(dy, dx);
      // Distance from the source (for radial falloff).
      const dist = vec2(dx, dy).length();

      const t = uTime.mul(uSpeed);

      // Animated noise around the angle: a cheap pseudo-noise from layered sines
      // of (angle * rays + time). fract(sin(...)) gives shimmering dust bands
      // drifting along the rays as time advances.
      const phase = angle.mul(uRays).add(t);
      const band = sin(phase).mul(0.5).add(0.5); // 0..1 ray structure
      const dust = fract(sin(phase.mul(2.7).add(dist.mul(40).sub(t.mul(3)))).mul(43758.5453))
        .mul(0.35)
        .add(0.65); // 0.65..1 shimmer modulation

      // Sharpen the ray bands into discrete shafts.
      const shaft = pow(band.mul(dust), uSharp);

      // Radial falloff: bright near the source, soft toward the edges.
      const falloff = float(1).div(float(1).add(dist.mul(uSpread).mul(dist.mul(uSpread))));

      const brightness = max(shaft.mul(falloff), float(0));

      // Warm light color in the shafts; soft cool ambient elsewhere (not black).
      const warm = vec3(1.0, 0.86, 0.55);
      const ambient = vec3(0.04, 0.05, 0.09);
      const color = ambient.add(warm.mul(brightness).mul(2.2));

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = color;
      // touch abs to keep import used in a stable form (defensive against tree shake)
      void abs;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test (and any host wiring).
      target.userData.lightShafts = { uTime, uRays, uSpeed, uSpread, uSharp };

      return {
        // Looping/stateful volumetric effect — animates continuously.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRays.value = num(params.rays, 18);
          uSpeed.value = num(params.speed, 1);
          uSpread.value = num(params.spread, 2);
          uSharp.value = num(params.sharp, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rays') uRays.value = num(value, 18);
          else if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'spread') uSpread.value = num(value, 2);
          else if (id === 'sharp') uSharp.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.lightShafts;
        },
      };
    },
  ),
};

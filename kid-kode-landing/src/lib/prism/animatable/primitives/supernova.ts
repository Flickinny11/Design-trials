// supernova — a star detonates: a blinding core flash expands into a shock
// shell of light and debris, then fades to a glowing remnant. Looping.
// HARD / GPU volumetric primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial whose colorNode/opacityNode are driven by a looping
// phase lt = fract(uTime*novaRate): an exponential core flash (blinding at
// loop start), an expanding ring shell, and anisotropic rays from the center,
// across a white -> blue -> violet palette. seek() advances uTime; params are
// read live so control changes apply without a rebuild.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  length,
  exp,
  smoothstep,
  fract,
  max,
  abs,
  atan,
  cos,
  mix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'novaRate', label: 'Nova Rate', type: 'knob', min: 0.05, max: 1.5, step: 0.01, default: 0.4 },
  { id: 'maxR', label: 'Shell Size', type: 'knob', min: 0.3, max: 1.2, step: 0.01, default: 0.7 },
  { id: 'rays', label: 'Rays', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

export const supernovaPrimitive: PrimitiveDefinition = {
  name: 'supernova',
  label: 'Supernova',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A star detonates — a blinding core flash expanding into a shock shell of light and debris, fading to a glowing remnant. Looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'supernova', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRate = uniform(num(params.novaRate, 0.4));
      const uMaxR = uniform(num(params.maxR, 0.7));
      const uRays = uniform(num(params.rays, 0.6));

      // Looping detonation phase 0..1.
      const lt = fract(uTime.mul(uRate));

      // Radius + angle from the plane center.
      const u = uv();
      const p = vec2(u.x.sub(0.5), u.y.sub(0.5));
      const r = length(p);
      const ang = atan(p.y, p.x);

      // Blinding core flash: sharp exponential spike that decays over the first
      // quarter of the loop (max(0, 1 - lt*4)).
      const flash = exp(r.mul(-200)).mul(max(float(0), float(1).sub(lt.mul(4))));

      // Expanding ring shell: a thin annulus whose radius grows with lt, fading
      // out as the loop progresses (1 - lt).
      const edge = float(0.04);
      const shellW = float(0.16);
      const ringR = lt.mul(uMaxR);
      const outer = smoothstep(ringR, ringR.sub(edge), r);
      const inner = smoothstep(ringR.sub(shellW), ringR, r);
      const shell = outer.mul(inner).mul(float(1).sub(lt));

      // Anisotropic rays: cosine streaks in angle, brightest at the core, fading
      // with the loop. Scaled by the rays control.
      const streak = max(float(0), cos(ang.mul(6.0)).mul(abs(cos(ang.mul(6.0)))));
      const rayFall = exp(r.mul(-6.0));
      const rays = streak.mul(rayFall).mul(uRays).mul(float(1).sub(lt));

      // Combined emission for opacity.
      let bright: any = flash;
      bright = max(bright, shell);
      bright = max(bright, rays);

      // Palette: white core -> blue mid -> violet remnant, blended by radius and
      // loop progress so the detonation cools as it expands.
      const white = vec3(1.0, 1.0, 1.0);
      const blue = vec3(0.35, 0.55, 1.0);
      const violet = vec3(0.6, 0.3, 0.95);
      const coolByR = smoothstep(float(0.0), uMaxR, r);
      const coolByT = lt;
      const cool = max(coolByR, coolByT);
      const palette = mix(white, mix(blue, violet, cool), cool);

      const colorNode = palette.mul(bright);
      const opacityNode = max(float(0), bright);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles on the shared scratch space so the host
      // (and conformance harness) can observe the driven state without a GPU.
      target.userData.supernova = { uTime, uRate, uMaxR, uRays };

      return {
        // Stateful / looping — animate continuously.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRate.value = num(params.novaRate, 0.4);
          uMaxR.value = num(params.maxR, 0.7);
          uRays.value = num(params.rays, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'novaRate') uRate.value = num(value, 0.4);
          else if (id === 'maxR') uMaxR.value = num(value, 0.7);
          else if (id === 'rays') uRays.value = num(value, 0.6);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

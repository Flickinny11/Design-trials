// ripple-displace — a shockwave ripple distorts the card's surface as it
// reveals, the warp radiating out from the center and flattening to crisp as it
// settles. HARD / displacement primitive. Swaps the host card's material for a
// MeshStandardNodeMaterial whose colorNode samples a node-built radial gradient
// through a uv warped by a decaying ripple (warp = sin(r*freq - prog*speed) *
// amp * (1 - prog)), and whose opacityNode is a smoothstep reveal over progress.
// seek() advances uProgress 0 -> 1; the warp amplitude decays to 0 at the end so
// the surface lands crisp. DISTINCT from `ripple` (geometry displacement) — this
// warps the *uv* used to paint the surface, not the mesh vertices.
//
// Observable on CPU (headless): uProgress.value advances monotonically across
// seek (asserted by the test). Restores the previous material in dispose.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  length,
  sin,
  smoothstep,
  mix,
  fract,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'freq', label: 'Frequency', type: 'knob', min: 6, max: 30, step: 0.5, default: 16 },
  { id: 'amplitude', label: 'Amplitude', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.12 },
] as const;

export const rippleDisplacePrimitive: PrimitiveDefinition = {
  name: 'ripple-displace',
  label: 'Ripple Displace',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    "A shockwave ripple distorts the card's surface as it reveals, the warp radiating out and flattening to crisp.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ripple-displace', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uProgress = uniform(0);
      const uFreq = uniform(num(params.freq, 16));
      const uAmp = uniform(num(params.amplitude, 0.12));
      const uSpeed = uniform(7);

      // Radial ripple warp: distance from center drives a decaying sine whose
      // amplitude falls to 0 as progress -> 1, so the surface settles crisp.
      const u = uv();
      const centered = u.sub(vec2(0.5, 0.5));
      const r = length(centered);
      const warp = sin(r.mul(uFreq).sub(uProgress.mul(uSpeed)))
        .mul(uAmp)
        .mul(float(1).sub(uProgress));

      // Push the uv outward along the radial direction by the warp amount.
      const warpedUv = u.add(centered.mul(warp.mul(float(4))));

      // Procedural surface: a radial gradient (center -> edge) plus a faint grid
      // built from the warped uv, so the ripple is visible as a moving distortion
      // of the painted pattern rather than via any external texture.
      const wr = length(warpedUv.sub(vec2(0.5, 0.5)));
      const grad = smoothstep(float(0), float(0.72), wr).oneMinus();
      const gridU = fract(warpedUv.x.mul(float(8)));
      const gridV = fract(warpedUv.y.mul(float(8)));
      const lineU = smoothstep(float(0.46), float(0.5), gridU.sub(float(0.5)).abs().oneMinus());
      const lineV = smoothstep(float(0.46), float(0.5), gridV.sub(float(0.5)).abs().oneMinus());
      const grid = lineU.max(lineV).mul(float(0.35));

      const core = vec3(0.11, 0.16, 0.28);
      const glow = vec3(0.36, 0.55, 1.0);
      const surface = mix(core, glow, grad.clamp(0, 1)).add(glow.mul(grid));
      const colorNode = surface;

      // Reveal: opacity smoothsteps in over the first portion of progress.
      const opacityNode = smoothstep(float(0), float(0.55), uProgress);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      mat.color.set('#1b2444');
      mat.roughness = 0.32;
      mat.metalness = 0.45;
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose progress + warp-amplitude on shared scratch space so the
      // host/tests can observe the reveal sweep and the live control wiring —
      // the warp itself lives entirely in the GPU colorNode.
      target.userData.uProgress = uProgress;
      target.userData.uAmp = uAmp;

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const ph = dur <= 0 ? 1 : Math.min(Math.max(t / dur, 0), 1);
          uProgress.value = ph;
          // Live reads so control changes apply without a rebuild.
          uFreq.value = num(params.freq, 16);
          uAmp.value = num(params.amplitude, 0.12);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'freq') uFreq.value = num(value, 16);
          else if (id === 'amplitude') uAmp.value = num(value, 0.12);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};

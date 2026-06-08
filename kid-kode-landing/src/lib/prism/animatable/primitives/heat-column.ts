// heat-column — a shimmering column of rising heat glows faintly, the air
// distorting and wobbling upward over an unseen ember bed. HARD / GPU primitive
// (volumetric category). Swaps the host plane's material for a
// MeshBasicNodeMaterial whose warmth = envelope(centered x) * (0.5 + 0.5*fbm)
// with a low-saturation orange tint; a horizontal wobble cx = sin(uv.y*4 +
// uTime)*wobble shears the column for heat-shimmer distortion. Brighter low,
// fading up; opacityNode = warmth so the air itself reads as a faint glow.
// DISTINCT from fire-flame: no visible flame, just a distorting heat-glow column.
// seek() advances the time uniform; onParamChange() updates the live uniforms.
// Uniform handles are published on target.userData so the headless CPU test can
// observe motion.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  floor,
  fract,
  dot,
  mix,
  abs,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.1, step: 0.005, default: 0.05 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
] as const;

// Generic TSL node. The three/tsl chain types are loose and fight strict tsc
// (caustics.ts/steam.ts dodge this by treating nodes opaquely and casting at the
// material-assignment boundary). We do the same: every node is an opaque `N`
// with chainable methods, and we funnel all TSL builder calls through `n()` so
// tsc never tries to unify the narrow generic variants.
type N = {
  add: (o: unknown) => N;
  sub: (o: unknown) => N;
  mul: (o: unknown) => N;
  x: N;
  y: N;
};
const n = (node: unknown): N => node as N;

// Value-noise hash + interpolation, then fbm, built purely from TSL nodes so it
// runs on the GPU. Deterministic — no Math.random.
function hash(p: N): N {
  // fract(sin(dot(p, (12.9898, 78.233))) * 43758.5453)
  const d = n(dot(p as never, vec2(12.9898, 78.233) as never));
  return n(fract(n(sin(d as never)).mul(43758.5453) as never));
}

function valueNoise(p: N): N {
  const i = n(floor(p as never));
  const f = n(fract(p as never));
  // smoothstep weights: f*f*(3-2f)
  const u = f.mul(f).mul(n(float(3)).sub(f.mul(2)));

  const a = hash(i);
  const b = hash(i.add(vec2(1, 0)));
  const c = hash(i.add(vec2(0, 1)));
  const d = hash(i.add(vec2(1, 1)));

  const ab = n(mix(a as never, b as never, u.x as never));
  const cd = n(mix(c as never, d as never, u.x as never));
  return n(mix(ab as never, cd as never, u.y as never));
}

function fbm(p: N): N {
  // `any` alias — reassigning a fluent TSL accumulator trips the narrow VarNode
  // typing under strict tsc (bit splat-reveal.ts / pool-caustics.ts).
  let value: any = n(float(0));
  let amp = 0.5;
  let freq = 1.0;
  for (let o = 0; o < 4; o++) {
    const sample = valueNoise(p.mul(freq)).mul(amp);
    value = value.add(sample);
    amp *= 0.5;
    freq *= 2.0;
  }
  return value as N;
}

export const heatColumnPrimitive: PrimitiveDefinition = {
  name: 'heat-column',
  label: 'Heat Column',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A shimmering column of rising heat glows faintly, the air distorting and wobbling upward over an unseen ember bed.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'heat-column', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1));
      const uWobble = uniform(num(params.wobble, 0.05));
      const uIntensity = uniform(num(params.intensity, 1));

      // Publish uniform handles for the CPU test (and any host introspection).
      target.userData.heatColumnUniforms = { uTime, uRise, uWobble, uIntensity };

      const u = uv();
      const ux = n(u).x;
      const uy = n(u).y;

      // Heat-shimmer distortion: shear the sampled x by a vertically-travelling
      // wobble cx = sin(uv.y*4 + uTime) * wobble so the column wavers as it rises.
      const cx = n(sin(uy.mul(4).add(uTime) as never)).mul(uWobble);
      const wx = ux.add(cx);

      // Centered-x envelope: bright down the middle, falling off to the sides.
      // envelope = smoothstep(0.5, 0.0, |x - 0.5|) → 1 at center, 0 at edges.
      const distC = n(abs(wx.sub(0.5) as never));
      const envelope = n(smoothstep(float(0.5) as never, float(0.0) as never, distC as never));

      // Rising fbm field: vertical advection uv.y*6 - uTime*rise, plus a little
      // horizontal frequency on x. warmth = envelope * (0.5 + 0.5*fbm).
      const noisePos = n(vec2(wx.mul(4) as never, uy.mul(6).sub(n(uTime).mul(uRise)) as never));
      const f = fbm(noisePos);
      const turbulence = n(float(0.5)).add(f.mul(0.5));

      // Brighter low, fading up: a vertical falloff multiplies the warmth.
      const vertical = n(tslClamp(n(float(1)).sub(uy) as never, float(0) as never, float(1) as never));

      const warmth = envelope.mul(turbulence).mul(vertical).mul(uIntensity);

      // Low-saturation warm orange tint (not a vivid flame) scaled by warmth.
      const tint = n(vec3(1.0, 0.62, 0.34));
      const colorNode = tint.mul(warmth);
      // opacityNode = warmth: the air itself glows faintly, denser at the base.
      const opacityNode = tslClamp(warmth as never, float(0) as never, float(1) as never);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful / looping upward advection — animate continuously.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 1);
          uWobble.value = num(params.wobble, 0.05);
          uIntensity.value = num(params.intensity, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1);
          else if (id === 'wobble') uWobble.value = num(value, 0.05);
          else if (id === 'intensity') uIntensity.value = num(value, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.heatColumnUniforms;
          mat.dispose();
        },
      };
    },
  ),
};

// smoke-ring — a discrete vortex smoke ring puffs out and drifts UPWARD,
// EXPANDING and THINNING as it rises, fading near the top. HARD / GPU primitive
// (smoke category). Swaps the host plane's material for a MeshBasicNodeMaterial
// whose opacityNode/colorNode build a toroidal puff:
//   cy          = 0.3 + uTime*rise           (ring center rises, wraps/loops)
//   r           = length(uv - vec2(0.5, cy))
//   ringRadius  = baseR + uTime*expand       (ring grows as it climbs)
//   band        = exp(-((r - ringRadius)/thickness)^2)   (torus cross-section)
// fbm turbulence is added to the band (puffy, broken edges) and alpha fades as
// the ring rises. seek() advances the time uniform; onParamChange() updates the
// live uniforms.
//
// DISTINCT from smoke-plume.ts (a continuous, curling rising COLUMN that widens
// with height) and wispy-smoke.ts (thin drifting filaments): this is a SINGLE
// discrete ring — a toroidal cross-section that translates up, dilates, and
// thins, looping when it reaches the crown.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  exp,
  floor,
  fract,
  dot,
  mix,
  length,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

// The three/tsl chain types are loose and fight strict tsc (caustics.ts dodges
// this by treating nodes opaquely and casting at the material-assignment
// boundary). We do the same: every node is an opaque `N` with chainable methods,
// funnelled through `n()` so tsc never tries to unify the narrow variants.
type N = {
  add: (o: unknown) => N;
  sub: (o: unknown) => N;
  mul: (o: unknown) => N;
  div: (o: unknown) => N;
  abs: () => N;
  negate: () => N;
  x: N;
  y: N;
};
const n = (node: unknown): N => node as N;

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.05, max: 1.5, step: 0.01, default: 0.35 },
  { id: 'expand', label: 'Expand', type: 'knob', min: 0, max: 1.2, step: 0.01, default: 0.4 },
  { id: 'thickness', label: 'Thickness', type: 'knob', min: 0.02, max: 0.2, step: 0.005, default: 0.07 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.6 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#9aa0b0' },
] as const;

// Value-noise hash + fbm built purely from TSL nodes so it runs on the GPU.
// Deterministic — no Math.random.
function hash(p: N): N {
  const d = n(dot(p as never, vec2(127.1, 311.7) as never));
  return n(fract(n(sin(d as never)).mul(43758.5453) as never));
}

function valueNoise(p: N): N {
  const i = n(floor(p as never));
  const f = n(fract(p as never));
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
  let value: N = n(float(0));
  let amp = 0.5;
  let freq = 1.0;
  for (let o = 0; o < 4; o++) {
    const sample = valueNoise(p.mul(freq)).mul(amp);
    value = value.add(sample);
    amp *= 0.5;
    freq *= 2.0;
  }
  return value;
}

export const smokeRingPrimitive: PrimitiveDefinition = {
  name: 'smoke-ring',
  label: 'Smoke Ring',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A vortex smoke ring puffs out and drifts upward, expanding and thinning as it rises — a toroidal puff.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke-ring', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#9aa0b0'));

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 0.35));
      const uExpand = uniform(num(params.expand, 0.4));
      const uThickness = uniform(num(params.thickness, 0.07));
      const uTurb = uniform(num(params.turbulence, 0.6));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can observe motion.
      target.userData.smokeRing = { uTime, uRise, uExpand, uThickness, uTurb };

      const u = uv();
      const ux = n(u).x;
      const uy = n(u).y;

      // Ring center rises and wraps: looped time (period 1.4) keeps the ring
      // re-spawning at the bottom so the effect repeats forever.
      const period = float(1.4);
      const loopT = n(fract(n(uTime).div(period) as never)).mul(period);
      const cy = n(float(0.3)).add(loopT.mul(uRise));

      // Distance from the (rising) ring center: r = length(uv - vec2(0.5, cy)).
      const centered = n(vec2(ux.sub(0.5) as never, uy.sub(cy) as never));
      const r = n(length(centered as never));

      // Ring radius grows as the puff climbs.
      const ringRadius = n(float(0.06)).add(loopT.mul(uExpand));

      // Torus cross-section: a gaussian band centered on ringRadius. Thickness
      // grows mildly with height so the ring THINS in density but reads softer
      // as it dilates.
      const thick = n(uThickness).add(loopT.mul(0.04));
      const d = r.sub(ringRadius).div(thick);
      const band = n(exp(d.mul(d).negate() as never));

      // fbm turbulence breaks up the band into a puffy, vaporous edge. Sampled
      // in a frame that drifts upward with the ring so the texture co-moves.
      const turbPos = n(vec2(ux.mul(5.0) as never, uy.sub(loopT).mul(5.0) as never));
      const turb = n(float(1)).sub(n(uTurb).mul(0.5)).add(fbm(turbPos).mul(uTurb));

      // Alpha fades as the ring rises (thins out toward the crown) and is faint
      // at the very moment of spawn.
      const heightFade = n(float(1)).sub(loopT.div(period).mul(0.85));
      const density = band.mul(turb).mul(heightFade);

      // Smoke greys; lift faintly where the band is densest.
      const colorNode = vec3(uR, uG, uB).add(vec3(0.05, 0.05, 0.06).mul(density as never));
      const opacityNode = tslClamp(
        density.mul(1.2) as never,
        float(0) as never,
        float(0.92) as never,
      );

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously looping ring — runs off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 0.35);
          uExpand.value = num(params.expand, 0.4);
          uThickness.value = num(params.thickness, 0.07);
          uTurb.value = num(params.turbulence, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 0.35);
          else if (id === 'expand') uExpand.value = num(value, 0.4);
          else if (id === 'thickness') uThickness.value = num(value, 0.07);
          else if (id === 'turbulence') uTurb.value = num(value, 0.6);
          else if (id === 'tint' && typeof value === 'string') {
            const [r1, g1, b1] = rgb(value);
            uR.value = r1;
            uG.value = g1;
            uB.value = b1;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.smokeRing;
          mat.dispose();
        },
      };
    },
  ),
};

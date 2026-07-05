// steam — hot steam billows upward in soft translucent plumes that thin as they
// rise. HARD / GPU primitive (smoke category). Swaps the host plane's material
// for a MeshBasicNodeMaterial whose colorNode is an fbm field advected upward
// (uv.y - uTime*rise) with a gentle horizontal sway, tinted brighter/whiter than
// smoke, and whose opacityNode is a vertical alpha gradient (dense at the base,
// thin at the top) modulated by the same plume field. seek() advances the time
// uniform; onParamChange() updates the live uniforms. Uniform handles are
// published on target.userData so the headless CPU test can observe motion.

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
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0, max: 3, step: 0.05, default: 1 },
  { id: 'density', label: 'Density', type: 'knob', min: 0.2, max: 2.5, step: 0.05, default: 1 },
] as const;

// Generic TSL node. The three/tsl chain types are loose and fight strict tsc
// (caustics.ts dodges this by treating nodes opaquely and casting at the
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
  let value = n(float(0));
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

export const steamPrimitive: PrimitiveDefinition = {
  name: 'steam',
  label: 'Steam',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Hot steam billows upward in soft translucent plumes that thin as they rise.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'steam', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1));
      const uSpread = uniform(num(params.spread, 1));
      const uDensity = uniform(num(params.density, 1));

      // Publish uniform handles for the CPU test (and any host introspection).
      target.userData.steamUniforms = { uTime, uRise, uSpread, uDensity };

      const u = uv();
      const ux = n(u).x;
      const uy = n(u).y;

      // Horizontal sway: uv.x + sin(uv.y*3 + uTime) * spread * 0.1
      const sway = n(sin(uy.mul(3).add(uTime) as never)).mul(uSpread).mul(0.1);
      const sx = ux.add(sway);
      // Advect the field upward: uv.y - uTime * rise
      const sy = uy.sub(n(uTime).mul(uRise));

      const samplePos = n(vec2(sx.mul(3) as never, sy.mul(3) as never));
      const plume = fbm(samplePos).mul(uDensity);

      // Brighter / whiter than smoke — warm-white steam tint scaled by the plume.
      const steamColor = n(vec3(0.92, 0.95, 1.0));
      const colorNode = steamColor.mul(
        tslClamp(plume as never, float(0) as never, float(1) as never),
      );

      // Vertical alpha gradient: dense at base (uv.y=0), thin at top (uv.y=1).
      const verticalFade = n(tslClamp(n(float(1)).sub(uy) as never, float(0) as never, float(1) as never));
      const opacityNode = tslClamp(
        plume.mul(verticalFade) as never,
        float(0) as never,
        float(1) as never,
      );

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
          uSpread.value = num(params.spread, 1);
          uDensity.value = num(params.density, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1);
          else if (id === 'spread') uSpread.value = num(value, 1);
          else if (id === 'density') uDensity.value = num(value, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.steamUniforms;
          mat.dispose();
        },
      };
    },
  ),
};

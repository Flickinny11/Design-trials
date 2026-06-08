// smoke-plume — a directed, turbulent smoke plume rises and curls upward,
// billowing WIDER as it ascends and dissipating at the top. HARD / GPU
// primitive (smoke category). Swaps the host plane's material for a
// MeshBasicNodeMaterial whose opacityNode/colorNode sample an fbm field
// advected upward (uv.y - uTime*rise) with a horizontal CURL
// (uv.x + sin(uv.y*curlFreq + uTime)*curl), then mask the density with a
// VERTICAL DISSIPATION ENVELOPE: a column whose half-width grows with height
// (wider toward the top) while its overall density falls off near the top
// (fainter toward the top). seek() advances the time uniform; onParamChange()
// updates the live uniforms.
//
// DISTINCT from wispy-smoke.ts (thin filaments that fade out near the top) and
// steam.ts (soft plume with a plain linear vertical alpha fade): this is a
// DIRECTED rising, curling COLUMN with a bell-like envelope that visibly
// widens as it climbs and dissipates at the crown.

import { Mesh, Color, type Material } from 'three';
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
  smoothstep,
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
// boundary). We do the same: every node is an opaque `N` with chainable
// methods, and we funnel TSL builder calls through `n()` so tsc never tries to
// unify the narrow generic variants.
type N = {
  add: (o: unknown) => N;
  sub: (o: unknown) => N;
  mul: (o: unknown) => N;
  abs: () => N;
  x: N;
  y: N;
};
const n = (node: unknown): N => node as N;

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 0.9 },
  { id: 'curl', label: 'Curl', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.8 },
  { id: 'density', label: 'Density', type: 'knob', min: 0.2, max: 2.5, step: 0.05, default: 1 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#9aa0b0' },
] as const;

// Value-noise hash + fbm, built purely from TSL nodes so it runs on the GPU.
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

export const smokePlumePrimitive: PrimitiveDefinition = {
  name: 'smoke-plume',
  label: 'Smoke Plume',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A turbulent smoke plume rises and curls upward, billowing wider as it ascends and dissipates at the top.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke-plume', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#9aa0b0'));

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 0.9));
      const uCurl = uniform(num(params.curl, 0.8));
      const uDensity = uniform(num(params.density, 1));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can observe motion.
      target.userData.smokePlume = { uTime, uRise, uCurl, uDensity };

      const u = uv();
      const ux = n(u).x;
      const uy = n(u).y;

      // Horizontal curl: shift uv.x by sin(uv.y*curlFreq + uTime) so the rising
      // column serpentines side-to-side as it climbs. Curl grows mildly with
      // height for a more turbulent crown.
      const curlFreq = float(7.0);
      const curlOffset = n(sin(uy.mul(curlFreq).add(uTime) as never))
        .mul(uCurl)
        .mul(0.16)
        .mul(n(float(0.4)).add(uy.mul(0.6)));
      const cx = ux.add(curlOffset);
      // Advect the field upward: uv.y - uTime*rise scrolls the noise downward so
      // the plume appears to rise.
      const ay = uy.sub(n(uTime).mul(uRise));

      const samplePos = n(vec2(cx.mul(3.2) as never, ay.mul(3.2) as never));
      const turb = fbm(samplePos).mul(uDensity);

      // ── Vertical dissipation envelope ────────────────────────────────────
      // The plume is a column whose HALF-WIDTH grows with height (wider toward
      // the top) and whose overall density FALLS OFF toward the crown (fainter
      // toward the top). The result reads as a billowing plume that opens up and
      // dissipates as it climbs — the defining trait vs. wispy-smoke/steam.
      const halfWidth = n(float(0.12)).add(uy.mul(0.42)); // widens with height
      const distFromCenter = n(cx.sub(0.5)).abs();
      // 1 inside the column, smoothly 0 past the (height-dependent) half-width.
      const columnMask = n(
        float(1) as never,
      ).sub(
        n(smoothstep(float(0) as never, halfWidth as never, distFromCenter as never)),
      );
      // Faint near the very base (source) and the very top (dissipation): a
      // soft falloff that drops density toward the crown.
      const heightFalloff = n(
        smoothstep(float(0) as never, float(0.18) as never, uy as never),
      ).mul(
        n(float(1)).sub(n(smoothstep(float(0.55) as never, float(1.05) as never, uy as never))),
      );

      const density = turb.mul(columnMask).mul(heightFalloff);

      // Smoke greys; lift faintly where the plume is densest.
      const colorNode = vec3(uR, uG, uB).add(
        vec3(0.06, 0.06, 0.07).mul(density as never),
      );
      const opacityNode = tslClamp(
        density.mul(1.3) as never,
        float(0) as never,
        float(0.9) as never,
      );

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously rising plume — runs off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 0.9);
          uCurl.value = num(params.curl, 0.8);
          uDensity.value = num(params.density, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 0.9);
          else if (id === 'curl') uCurl.value = num(value, 0.8);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.smokePlume;
          mat.dispose();
        },
      };
    },
  ),
};

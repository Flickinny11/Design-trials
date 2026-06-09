// _volume-fbm — a shared, premium smooth-noise field for FULL-FRAME volumetric
// primitives (fog / smoke / clouds / dust / wisps). Unlike a flame, these fill the
// whole quad, so the noise's underlying integer LATTICE is fully visible — naive
// low-frequency value noise reads as a blocky axis-aligned tile grid (the exact
// defect the user-advocate gate flagged on the single-plane volumetric tiles).
//
// This helper kills the grid three ways at once:
//   1. QUINTIC interpolation (6t⁵−15t⁴+10t³, C2-continuous) → no first-derivative
//      seams between cells (smoother than the cubic/Hermite f·f·(3−2f)).
//   2. Per-octave domain ROTATION (~0.5 rad) → successive octaves never align into
//      an axis-aligned square grid; the structure reads organic, not tiled.
//   3. DOMAIN WARP → the low-frequency (large-cell) structure is displaced by a
//      higher-frequency field, so the big "fog bank" shapes become wavy blobs
//      instead of visible squares.
//
// TSL only. Loose-cast node discipline (matches fire-flame.ts) so strict vec2
// join-node typing does not pin the helper params.

import { vec2, float, floor, fract, sin, dot, mix } from 'three/tsl';

type TVec = ReturnType<typeof vec2>;
const asNode = (p: unknown) => p as TVec;
// Permissive vec2 join (matches the loose-cast discipline in the primitives): the
// strict TSL vec2 overloads reject two arbitrary chained nodes, but the runtime
// node graph accepts them — the built graph is identical to the free-function form.
const v2 = (a: unknown, b: unknown) => (vec2 as unknown as (x: unknown, y: unknown) => unknown)(a, b) as TVec;

const hash = (p0: unknown) => {
  const p = asNode(p0);
  return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
};

// Smooth value noise with QUINTIC interpolation weights (C2-continuous).
const vnoise = (p0: unknown) => {
  const p = asNode(p0);
  const i = floor(p);
  const f = fract(p);
  // quintic: f*f*f*(f*(f*6-15)+10)
  const u = f.mul(f).mul(f).mul(f.mul(f.mul(6).sub(15)).add(10));
  const a = hash(i);
  const b = hash(i.add(vec2(1, 0)));
  const c = hash(i.add(vec2(0, 1)));
  const d = hash(i.add(vec2(1, 1)));
  const x1 = mix(a, b, u.x);
  const x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
};

// Rotate a node-domain vec2 by a fixed angle (constants folded at author time).
const ROT_C = Math.cos(0.5);
const ROT_S = Math.sin(0.5);
const rot = (p0: unknown) => {
  const p = asNode(p0);
  return vec2(p.x.mul(ROT_C).sub(p.y.mul(ROT_S)), p.x.mul(ROT_S).add(p.y.mul(ROT_C)));
};

/**
 * Rotated-octave value-noise fbm, normalised to ~[0,1]. `octaves` defaults to 5
 * (lacunarity ~1.97). Use a base frequency of at least ~6 so the largest cells are
 * small; the rotation + quintic interp keep it from ever reading as a square grid.
 */
export function fbmRot(p0: unknown, octaves = 5): TVec {
  let p = asNode(p0);
  let amp = 0.5;
  let norm = 0;
  let sum = float(0) as unknown as TVec;
  for (let o = 0; o < octaves; o++) {
    sum = sum.add(vnoise(p).mul(amp)) as unknown as TVec;
    norm += amp;
    amp *= 0.5;
    p = rot(p).mul(1.97) as unknown as TVec;
  }
  return sum.div(norm) as unknown as TVec;
}

/**
 * Domain-warped fbm: samples fbmRot at a point displaced by another fbmRot field,
 * so large-scale structure becomes organic wavy blobs (never visible squares).
 * `warp` is the displacement strength (≈0.6–1.4 reads well). Returns ~[0,1].
 */
export function fbmWarped(p0: unknown, warp = 1.0, octaves = 5): TVec {
  const p = asNode(p0);
  const wx = fbmRot(p, 3).sub(0.5);
  const wy = fbmRot(p.add(v2(5.2, 1.3)), 3).sub(0.5);
  const warped = p.add(v2(wx.mul(warp), wy.mul(warp)));
  return fbmRot(warped, octaves);
}

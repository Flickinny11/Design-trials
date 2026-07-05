'use client';

// Chrome-layer TSL escape hatch — same pattern as
// `src/lib/prism/runtime/shared/shaders/tsl-types.ts`: the three/tsl .d.ts is
// too strict for hand-built dynamic graphs, so the builder fns we need are
// re-exported under permissive types. Runtime objects are the real TSL nodes.

import * as TSL from 'three/tsl';

/** Permissive chained-node type (swizzles + arithmetic + node helpers). */
export interface TSLNode {
  add: (n: unknown) => TSLNode;
  sub: (n: unknown) => TSLNode;
  mul: (n: unknown) => TSLNode;
  div: (n: unknown) => TSLNode;
  abs: () => TSLNode;
  negate: () => TSLNode;
  oneMinus: () => TSLNode;
  saturate: () => TSLNode;
  max: (n: unknown) => TSLNode;
  min: (n: unknown) => TSLNode;
  level: (n: unknown) => TSLNode;
  r: TSLNode;
  g: TSLNode;
  b: TSLNode;
  a: TSLNode;
  rgb: TSLNode;
  x: TSLNode;
  y: TSLNode;
  z: TSLNode;
  w: TSLNode;
  xy: TSLNode;
  [k: string]: unknown;
}

/** A uniform node: usable in the graph AND writable from JS via .value. */
export type TSLUniform<V> = TSLNode & { value: V };

export const tsl = TSL as unknown as {
  uniform: <V>(v: V) => TSLUniform<V>;
  uv: () => TSLNode;
  vec2: (...a: unknown[]) => TSLNode;
  vec3: (...a: unknown[]) => TSLNode;
  vec4: (...a: unknown[]) => TSLNode;
  float: (n: unknown) => TSLNode;
  mix: (a: unknown, b: unknown, t: unknown) => TSLNode;
  step: (edge: unknown, x: unknown) => TSLNode;
  smoothstep: (e0: unknown, e1: unknown, x: unknown) => TSLNode;
  clamp: (x: unknown, lo: unknown, hi: unknown) => TSLNode;
  length: (x: unknown) => TSLNode;
  normalize: (x: unknown) => TSLNode;
  abs: (x: unknown) => TSLNode;
  min: (a: unknown, b: unknown) => TSLNode;
  max: (a: unknown, b: unknown) => TSLNode;
  exp: (x: unknown) => TSLNode;
  fwidth: (x: unknown) => TSLNode;
  dFdx: (x: unknown) => TSLNode;
  dFdy: (x: unknown) => TSLNode;
  instancedBufferAttribute: (attr: unknown) => TSLNode;
  texture: (tex: unknown, uvNode?: unknown) => TSLNode;
  viewportMipTexture: (uvNode?: unknown) => TSLNode;
  viewportSafeUV: (uvNode?: unknown) => TSLNode;
  screenUV: TSLNode;
  mx_noise_float: (x: unknown) => TSLNode;
  lights: (l: unknown[]) => TSLNode;
  pmremTexture: (tex: unknown, uvNode?: unknown) => TSLNode;
};

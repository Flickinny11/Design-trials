// Shared TSL escape hatch.
//
// `three/tsl` exposes a precisely-typed builder DSL whose .d.ts is too
// strict for hand-built graphs (every chained call enforces dim/precision
// inference). The TSL graphs themselves are dynamic node compositions —
// the bundler and the runtime accept any compatible node — so we re-export
// the few builder fns we need under permissive types.

import * as TSL from 'three/tsl';
import type { Texture } from 'three';

/** Permissive node type — TSL chains return self-similar nodes with
 *  swizzles and arithmetic methods. */
export interface TSLNode {
  add: (n: unknown) => TSLNode;
  sub: (n: unknown) => TSLNode;
  mul: (n: unknown) => TSLNode;
  div: (n: unknown) => TSLNode;
  abs: () => TSLNode;
  negate: () => TSLNode;
  oneMinus: () => TSLNode;
  saturate: () => TSLNode;
  r: TSLNode;
  g: TSLNode;
  b: TSLNode;
  a: TSLNode;
  rgb: TSLNode;
  rgba: TSLNode;
  xy: TSLNode;
  x: TSLNode;
  y: TSLNode;
  z: TSLNode;
  [k: string]: unknown;
}

export const tslFn = TSL as unknown as {
  uv: (...a: unknown[]) => TSLNode;
  texture: (tex: Texture, uvNode?: unknown) => TSLNode;
  vec2: (...a: unknown[]) => TSLNode;
  vec3: (...a: unknown[]) => TSLNode;
  vec4: (...a: unknown[]) => TSLNode;
  float: (n: unknown) => TSLNode;
  mix: (a: unknown, b: unknown, t: unknown) => TSLNode;
  step: (edge: unknown, x: unknown) => TSLNode;
  smoothstep: (edge0: unknown, edge1: unknown, x: unknown) => TSLNode;
  fract: (x: unknown) => TSLNode;
  sin: (x: unknown) => TSLNode;
  cos: (x: unknown) => TSLNode;
  dot: (a: unknown, b: unknown) => TSLNode;
  length: (x: unknown) => TSLNode;
  normalize: (x: unknown) => TSLNode;
  clamp: (x: unknown, min: unknown, max: unknown) => TSLNode;
  pow: (x: unknown, y: unknown) => TSLNode;
};

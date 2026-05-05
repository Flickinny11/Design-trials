// voronoi-particle.tsl — voronoi-driven pixel-particle effect.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L262-L263 — "Voronoi-driven
// pixel-particle effect. Used for image-to-particle transitions."
//
// Inputs:
//   uv          — UV node (caller may pass `uv()` or a custom UV)
//   time        — time uniform (seconds)
//   cellScale   — number of voronoi cells across the image (uniform)

import { tslFn, type TSLNode } from './tsl-types';

const { vec2, vec3, fract, sin, dot, length } = tslFn;

export interface VoronoiParticleShaderParams {
  uv: unknown;
  time: unknown;
  cellScale: unknown;
}

function hash22(p: TSLNode): TSLNode {
  const a = fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  const b = fract(sin(dot(p, vec2(269.5, 183.3))).mul(43758.5453));
  return vec2(a, b);
}

export function voronoiParticleShader(
  params: VoronoiParticleShaderParams,
): TSLNode {
  const baseUV = params.uv as TSLNode;
  const scaled = baseUV.mul(params.cellScale);
  const cell = vec2(scaled.x, scaled.y);
  const offset = hash22(cell);
  const point = cell.add(offset);
  const d = length(point.sub(scaled));
  const animated = d.add(fract(params.time));
  return vec3(animated, animated, animated);
}

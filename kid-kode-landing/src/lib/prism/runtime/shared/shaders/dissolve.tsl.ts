// dissolve.tsl — noise-based dissolve with optional emission edge.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L259-L260 — "Noise-based dissolve
// with optional emission edge. Used by `dissolve-morph` primitive."
//
// Inputs (per `dissolve-morph` params, CPL L106-L113):
//   baseTexture       — initial state
//   secondaryTexture  — final state
//   progress          — 0..1 dissolve progress
//   noiseScale        — controls dissolve grain size
//   edgeColor         — vec3, color of dissolving edge
//   edgeWidth         — width of colored edge during transition

import type { Texture } from 'three';
import { tslFn, type TSLNode } from './tsl-types';

const { uv, texture, vec2, vec3, vec4, mix, step, smoothstep, fract, sin, dot } =
  tslFn;

export interface DissolveShaderParams {
  baseTexture: Texture;
  secondaryTexture: Texture;
  progress: unknown;
  noiseScale: unknown;
  edgeColor: unknown;
  edgeWidth: unknown;
}

/** Cheap pseudo-random hash noise. Suitable for dissolve grain — NOT a
 *  high-quality noise function. */
function hashNoise(p: TSLNode): TSLNode {
  return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
}

export function dissolveShader(params: DissolveShaderParams): TSLNode {
  const baseUV = uv();
  const sampleA = texture(params.baseTexture, baseUV);
  const sampleB = texture(params.secondaryTexture, baseUV);

  const grain = hashNoise(baseUV.mul(params.noiseScale));
  // Where grain < progress, show secondary; else show base.
  const mask = step(grain, params.progress);
  const blended = mix(sampleA, sampleB, mask);

  // Edge tint where |grain - progress| is below edgeWidth.
  const edgeFalloff = smoothstep(params.edgeWidth, vec3(0, 0, 0), grain.sub(params.progress).abs());
  const edged = mix(blended.rgb, params.edgeColor, edgeFalloff);

  return vec4(edged, blended.a);
}

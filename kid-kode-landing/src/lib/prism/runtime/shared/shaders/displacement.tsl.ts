// displacement.tsl — distorts UVs based on a displacement map.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L256-L257 — "Distorts UVs based on
// a displacement map. Used by `displacement-transition` primitive and
// `parallax-plane` render mode."
//
// Inputs (per consuming primitive params, CPL L129-L134):
//   baseTexture          — source texture
//   displacementMap      — grayscale map driving the distortion direction
//   intensity            — peak distortion magnitude (TSL uniform/node)
//   secondaryTexture?    — optional cross-fade target
//   crossfadeProgress?   — 0..1 cross-fade between base and secondary

import type { Texture } from 'three';
import { tslFn, type TSLNode } from './tsl-types';

const { uv, texture, vec2, mix } = tslFn;

export interface DisplacementShaderParams {
  baseTexture: Texture;
  displacementMap: Texture;
  intensity: unknown;
  secondaryTexture?: Texture;
  crossfadeProgress?: unknown;
}

export function displacementShader(params: DisplacementShaderParams): TSLNode {
  const baseUV = uv();
  const dispSample = texture(params.displacementMap);
  const offsetX = dispSample.r.mul(params.intensity);
  const offsetY = dispSample.g.mul(params.intensity);
  const distortedUV = baseUV.add(vec2(offsetX, offsetY));
  const sampleA = texture(params.baseTexture, distortedUV);
  if (params.secondaryTexture && params.crossfadeProgress) {
    const sampleB = texture(params.secondaryTexture, distortedUV);
    return mix(sampleA, sampleB, params.crossfadeProgress);
  }
  return sampleA;
}

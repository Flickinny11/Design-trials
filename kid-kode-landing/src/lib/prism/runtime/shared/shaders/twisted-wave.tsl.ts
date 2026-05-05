// twisted-wave.tsl — sine-wave distortion with mouse-cursor amplification.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L265-L266 — "Sine-wave distortion
// with mouse-cursor amplification. Used for hover effects and ambient
// texture motion."
//
// Inputs:
//   baseTexture  — source texture
//   time         — time uniform (seconds)
//   cursor       — vec2 cursor position in NDC (-1..1)
//   amplitude    — peak distortion magnitude

import type { Texture } from 'three';
import { tslFn, type TSLNode } from './tsl-types';

const { uv, texture, vec2, sin, length } = tslFn;

export interface TwistedWaveShaderParams {
  baseTexture: Texture;
  time: unknown;
  cursor: unknown;
  amplitude: unknown;
}

export function twistedWaveShader(params: TwistedWaveShaderParams): TSLNode {
  const baseUV = uv();
  // Distance from cursor in UV space. Closer to cursor → bigger distortion.
  const fromCursor = baseUV.sub(params.cursor);
  const dist = length(fromCursor);
  // Sine wave radiates outward from cursor.
  const wave = sin(dist.mul(20).sub(params.time as unknown));
  const distortion = vec2(wave, wave).mul(params.amplitude).mul(dist.oneMinus());
  const distortedUV = baseUV.add(distortion);
  return texture(params.baseTexture, distortedUV);
}

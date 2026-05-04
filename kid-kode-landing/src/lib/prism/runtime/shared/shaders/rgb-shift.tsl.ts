// rgb-shift.tsl — chromatic aberration shift.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L271-L272 — "Chromatic aberration
// shift. Used for transitions and emphasis."
//
// Inputs:
//   baseTexture — source texture
//   offset      — vec2 channel-separation offset

import type { Texture } from 'three';
import { tslFn, type TSLNode } from './tsl-types';

const { uv, texture, vec4 } = tslFn;

export interface RgbShiftShaderParams {
  baseTexture: Texture;
  offset: unknown;
}

export function rgbShiftShader(params: RgbShiftShaderParams): TSLNode {
  const baseUV = uv();
  const r = texture(params.baseTexture, baseUV.add(params.offset)).r;
  const g = texture(params.baseTexture, baseUV).g;
  const b = texture(params.baseTexture, baseUV.sub(params.offset)).b;
  const a = texture(params.baseTexture, baseUV).a;
  return vec4(r, g, b, a);
}

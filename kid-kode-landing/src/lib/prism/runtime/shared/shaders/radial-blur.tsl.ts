// radial-blur.tsl — cinematic radial blur centered at a configurable point.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L268-L269 — "Cinematic radial blur
// centered at a configurable point. Used for camera transitions and focus
// emphasis."
//
// Inputs:
//   baseTexture  — source texture
//   center       — vec2, blur origin in UV (default vec2(0.5, 0.5))
//   strength     — float, peak displacement length

import type { Texture } from 'three';
import { tslFn, type TSLNode } from './tsl-types';

const { uv, texture, vec2 } = tslFn;

export interface RadialBlurShaderParams {
  baseTexture: Texture;
  center: unknown;
  strength: unknown;
}

/** 6-tap radial blur: average 6 samples along the radial vector. */
export function radialBlurShader(params: RadialBlurShaderParams): TSLNode {
  const baseUV = uv();
  const radial = baseUV.sub(params.center);
  let acc = texture(params.baseTexture, baseUV);
  for (let i = 1; i <= 5; i++) {
    const t = (i / 5) * 1;
    const sampleUV = baseUV.sub(radial.mul(t).mul(params.strength));
    acc = acc.add(texture(params.baseTexture, sampleUV));
  }
  // Voiding the strict-typed `vec2` import doesn't fail; keep a reference so
  // the import is used.
  void vec2;
  return acc.div(6);
}

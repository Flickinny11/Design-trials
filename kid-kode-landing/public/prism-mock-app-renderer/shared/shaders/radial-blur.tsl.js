// TSL shader: radial-blur (spec CINEMATIC-PRIMITIVES-LIBRARY.md TSL Shaders).
// Implementation lifted from runtime/shared/shaders/radial-blur.ts at bundle time.
import { Fn, vec3 } from 'three/tsl';

export const radialBlurTSL = Fn(({ uv }) => vec3(uv, 0));

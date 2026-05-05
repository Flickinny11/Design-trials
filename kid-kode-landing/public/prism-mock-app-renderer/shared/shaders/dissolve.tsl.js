// TSL shader: dissolve (spec CINEMATIC-PRIMITIVES-LIBRARY.md TSL Shaders).
// Implementation lifted from runtime/shared/shaders/dissolve.ts at bundle time.
import { Fn, vec3 } from 'three/tsl';

export const dissolveTSL = Fn(({ uv }) => vec3(uv, 0));

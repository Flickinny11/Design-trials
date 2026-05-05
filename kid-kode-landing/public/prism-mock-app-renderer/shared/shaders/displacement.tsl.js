// TSL shader: displacement (spec CINEMATIC-PRIMITIVES-LIBRARY.md TSL Shaders).
// Implementation lifted from runtime/shared/shaders/displacement.ts at bundle time.
import { Fn, vec3 } from 'three/tsl';

export const displacementTSL = Fn(({ uv }) => vec3(uv, 0));

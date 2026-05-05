// TSL shader: twisted-wave (spec CINEMATIC-PRIMITIVES-LIBRARY.md TSL Shaders).
// Implementation lifted from runtime/shared/shaders/twisted-wave.ts at bundle time.
import { Fn, vec3 } from 'three/tsl';

export const twistedWaveTSL = Fn(({ uv }) => vec3(uv, 0));

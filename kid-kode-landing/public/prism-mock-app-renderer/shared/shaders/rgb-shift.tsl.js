// TSL shader: rgb-shift (spec CINEMATIC-PRIMITIVES-LIBRARY.md TSL Shaders).
// Implementation lifted from runtime/shared/shaders/rgb-shift.ts at bundle time.
import { Fn, vec3 } from 'three/tsl';

export const rgbShiftTSL = Fn(({ uv }) => vec3(uv, 0));

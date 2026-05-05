// TSL shader: voronoi-particle (spec CINEMATIC-PRIMITIVES-LIBRARY.md TSL Shaders).
// Implementation lifted from runtime/shared/shaders/voronoi-particle.ts at bundle time.
import { Fn, vec3 } from 'three/tsl';

export const voronoiParticleTSL = Fn(({ uv }) => vec3(uv, 0));

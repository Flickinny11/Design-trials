// orbit primitive — target object orbits a point in 3D space.
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L57-L76.
//
// Stub committed in T03 step 6 to satisfy tsc; real implementation lands in
// step 7. Tests fail at runtime (throw) until then.

import type { PrimitiveFn } from './types';

export const orbitPrimitive: PrimitiveFn = () => {
  throw new Error('orbit primitive not implemented');
};

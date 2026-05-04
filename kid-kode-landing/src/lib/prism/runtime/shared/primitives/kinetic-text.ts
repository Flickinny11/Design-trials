// kinetic-text primitive — see CINEMATIC-PRIMITIVES-LIBRARY.md.
// Stub committed in T03 step 6 to satisfy tsc; real implementation lands
// in step 7. Tests fail at runtime (throw) until then.

import type { PrimitiveFn } from './types';

export const kineticTextPrimitive: PrimitiveFn = () => {
  throw new Error('kinetic-text primitive not implemented');
};

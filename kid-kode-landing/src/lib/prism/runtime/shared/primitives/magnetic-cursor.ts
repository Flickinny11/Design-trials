// magnetic-cursor primitive — see CINEMATIC-PRIMITIVES-LIBRARY.md.
// Stub committed in T03 step 6 to satisfy tsc; real implementation lands
// in step 7. Tests fail at runtime (throw) until then.

import type { PrimitiveFn } from './types';

export const magneticCursorPrimitive: PrimitiveFn = () => {
  throw new Error('magnetic-cursor primitive not implemented');
};

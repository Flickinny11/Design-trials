// EB-07-04 — Scroll-timeline + scrollBinding consumer (STUB).
//
// This is the failing-test stub: the API surface exists so the test file
// type-checks, but the bodies intentionally return wrong values so the
// failing tests in `tests/editor-build/EB-07-04.scroll-timeline.test.ts`
// stay red until the Step 7 implementation lands.

import type { Object3D } from 'three';
import type { ScrollBinding } from './types';

// SC-039: deterministic scroll progress over the hub's content length.
// Stub returns 0 unconditionally so the non-zero-progress tests fail.
export function computeScrollProgress(
  _scrollY: number,
  _contentHeight: number,
  _viewportHeight: number,
): number {
  return 0;
}

// SC-039: apply a scrollBinding[] consumer to a THREE Object3D.
// Stub no-op; transform-write tests fail until the implementation lands.
export function applyScrollBindings(
  _obj: Object3D,
  _bindings: readonly ScrollBinding[],
  _progress: number,
): void {
  /* stub */
}

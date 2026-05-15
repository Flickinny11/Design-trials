// EB-05-02 / §5 SC-023 — Canvas mode viewport frame overlay + safe-area bounds.
//
// TDD stub: signatures only, returns wrong values so EB-05-02 tests FAIL
// until Step 7 ships the real implementation. The shipped version will
// honor breakpoint scale + absolute safe-area inset per the SC-023 contract.

export interface CanvasViewportFrame {
  width: number;
  height: number;
  safeAreaInset: number;
  safe: { width: number; height: number };
}

export const CANVAS_VIEWPORT_FRAME_DEFAULTS: Readonly<{
  width: number;
  height: number;
  safeAreaInset: number;
}> = { width: 0, height: 0, safeAreaInset: 0 };

export function computeCanvasViewportFrame(
  _opts?: { breakpoint?: { scale?: number } | null },
): CanvasViewportFrame {
  return { width: 0, height: 0, safeAreaInset: 0, safe: { width: 0, height: 0 } };
}

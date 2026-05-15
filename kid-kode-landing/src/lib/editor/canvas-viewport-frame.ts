// EB-05-02 / §5 SC-023 — Canvas mode viewport frame overlay + safe-area bounds.
//
// Pure helper consumed by GraphScene's canvas-mode AssembledSceneContent
// branch. Returns the viewport frame dimensions and safe-area inset in
// design units (px). The default is desktop 1440×900 with a 24-px inset.
// When an active responsive breakpoint provides a `scale` (per
// `PrismHubResponsiveBreakpoint`), the frame outer dimensions multiply by
// it. The safe-area inset is absolute (it does not scale) so designers see
// a consistent thumb-safe rail across breakpoints.

export interface CanvasViewportFrame {
  width: number;
  height: number;
  safeAreaInset: number;
  safe: { width: number; height: number };
}

// Frozen so the renderer cannot accidentally mutate it.
export const CANVAS_VIEWPORT_FRAME_DEFAULTS: Readonly<{
  width: number;
  height: number;
  safeAreaInset: number;
}> = Object.freeze({ width: 1440, height: 900, safeAreaInset: 24 });

export function computeCanvasViewportFrame(
  opts?: { breakpoint?: { scale?: number } | null },
): CanvasViewportFrame {
  const scale = opts?.breakpoint?.scale ?? 1;
  const width = CANVAS_VIEWPORT_FRAME_DEFAULTS.width * scale;
  const height = CANVAS_VIEWPORT_FRAME_DEFAULTS.height * scale;
  const safeAreaInset = CANVAS_VIEWPORT_FRAME_DEFAULTS.safeAreaInset;
  return {
    width,
    height,
    safeAreaInset,
    safe: {
      width: width - safeAreaInset * 2,
      height: height - safeAreaInset * 2,
    },
  };
}

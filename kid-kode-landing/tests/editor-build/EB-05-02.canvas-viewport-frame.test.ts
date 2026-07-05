// EB-05-02 — Canvas mode viewport frame overlay + safe-area bounds.
//
// Spec refs:
//   §5 SC-023  "A viewport frame overlay renders with safe-area bounds
//               (default desktop 1440×900 with 24px safe-area inset)."
//
// haltCheck:
//   "Canvas mode renders a viewport frame overlay (default 1440x900 desktop
//    with 24px safe-area inset); frame respects the active responsive
//    breakpoint when set."
//
// Contract introduced by this task (additive helper):
//
//   - New module: src/lib/editor/canvas-viewport-frame.ts
//       export type CanvasViewportFrame = {
//         width: number; height: number; safeAreaInset: number;
//         safe: { width: number; height: number };
//       };
//       export const CANVAS_VIEWPORT_FRAME_DEFAULTS: Readonly<{
//         width: number; height: number; safeAreaInset: number;
//       }>;
//       export function computeCanvasViewportFrame(
//         opts?: { breakpoint?: { scale?: number } | null },
//       ): CanvasViewportFrame;
//
//     Pure: same input → identical output. Defaults: 1440×900, inset 24.
//     Breakpoint `scale` (per `PrismHubResponsiveBreakpoint`) multiplies the
//     outer dimensions; the safe-area inset is absolute (does not scale) so
//     designers see a consistent thumb-safe rail across breakpoints.
//
//   - GraphScene's canvas-mode scene branch MUST import this helper and MUST
//     render a `CanvasViewportFrame` component so the overlay is visible
//     whenever `viewMode === 'canvas'` (SC-023). The pure-function tests are
//     the primary regression; the source greps catch accidental removal of
//     the wiring during later refactors.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CANVAS_VIEWPORT_FRAME_DEFAULTS,
  computeCanvasViewportFrame,
} from '../../src/lib/editor/canvas-viewport-frame';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);

describe('EB-05-02 — computeCanvasViewportFrame (pure helper, SC-023)', () => {
  it('exports frozen defaults: 1440×900 outer, 24-px safe-area inset', () => {
    expect(Object.isFrozen(CANVAS_VIEWPORT_FRAME_DEFAULTS)).toBe(true);
    expect(CANVAS_VIEWPORT_FRAME_DEFAULTS.width).toBe(1440);
    expect(CANVAS_VIEWPORT_FRAME_DEFAULTS.height).toBe(900);
    expect(CANVAS_VIEWPORT_FRAME_DEFAULTS.safeAreaInset).toBe(24);
  });

  it('returns the default frame when no breakpoint is supplied', () => {
    const f = computeCanvasViewportFrame();
    expect(f.width).toBe(1440);
    expect(f.height).toBe(900);
    expect(f.safeAreaInset).toBe(24);
  });

  it('computes safe-area dims by insetting both sides by safeAreaInset', () => {
    const f = computeCanvasViewportFrame();
    expect(f.safe.width).toBe(1440 - 24 * 2);
    expect(f.safe.height).toBe(900 - 24 * 2);
  });

  it('respects the active breakpoint scale (frame dims multiply by scale)', () => {
    const f = computeCanvasViewportFrame({ breakpoint: { scale: 0.5 } });
    expect(f.width).toBe(720);
    expect(f.height).toBe(450);
  });

  it('keeps the safe-area inset absolute (does not scale with breakpoint)', () => {
    const f = computeCanvasViewportFrame({ breakpoint: { scale: 0.5 } });
    expect(f.safeAreaInset).toBe(24);
    expect(f.safe.width).toBe(720 - 24 * 2);
    expect(f.safe.height).toBe(450 - 24 * 2);
  });

  it('is deterministic — same input yields identical output', () => {
    const a = computeCanvasViewportFrame({ breakpoint: { scale: 0.75 } });
    const b = computeCanvasViewportFrame({ breakpoint: { scale: 0.75 } });
    expect(a).toEqual(b);
  });

  it('treats null/undefined breakpoint identically to no breakpoint', () => {
    const noArg = computeCanvasViewportFrame();
    expect(computeCanvasViewportFrame({ breakpoint: null })).toEqual(noArg);
    expect(computeCanvasViewportFrame({ breakpoint: undefined })).toEqual(noArg);
    expect(computeCanvasViewportFrame({})).toEqual(noArg);
  });

  it('does not mutate its input breakpoint (pure, no aliasing)', () => {
    const bp = { scale: 0.6 };
    const snapshot = { ...bp };
    computeCanvasViewportFrame({ breakpoint: bp });
    expect(bp).toEqual(snapshot);
  });
});

describe('EB-05-02 — GraphScene renders the canvas viewport frame overlay (SC-023)', () => {
  it('imports computeCanvasViewportFrame from the canvas-viewport-frame helper', () => {
    expect(graphSceneSrc).toMatch(/computeCanvasViewportFrame/);
  });

  it('declares a CanvasViewportFrame component for the canvas-mode overlay', () => {
    expect(graphSceneSrc).toMatch(/function\s+CanvasViewportFrame\s*\(/);
  });

  it('mounts <CanvasViewportFrame /> inside the assembled scene', () => {
    expect(graphSceneSrc).toMatch(/<CanvasViewportFrame\b/);
  });

  it("gates the frame on viewMode === 'canvas' (FP-12: canonical literal)", () => {
    expect(graphSceneSrc).toMatch(/viewMode\s*===\s*['"]canvas['"]/);
  });
});

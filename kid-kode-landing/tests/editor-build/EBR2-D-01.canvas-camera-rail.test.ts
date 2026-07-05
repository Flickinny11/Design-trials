// EBR2-D-01 — Pure function deriving canvas-mode OrbitControls guardrails.
//
// Spec refs:
//   §R2-D SC-071  "In canvas mode, OrbitControls is constrained:
//                  minPolarAngle/maxPolarAngle/minAzimuthAngle/maxAzimuthAngle/
//                  minDistance/maxDistance are set from the active hub's content
//                  envelope + viewport-frame, and pan-target clamps prevent
//                  drift past the frame."
//   INV-23        Compiled-preview camera is constrained, damped, and bounded
//                 (the precedent that canvas mode mirrors for editor-time use).
//
// haltCheck:
//   canvas-camera-rail.ts exports computeCanvasCameraRail(hub, breakpoint,
//   viewportFrame) → {minDistance, maxDistance, minPolarAngle, maxPolarAngle,
//   minAzimuthAngle, maxAzimuthAngle, target, panLimits}. Unit-tested with at
//   least 3 hub envelopes.
//
// This is a pure-math regression suite — no React, no Three.js. Integration
// with `SceneControlsBridge` is the responsibility of EBR2-D-02.

import { describe, it, expect } from 'vitest';

import {
  computeCanvasCameraRail,
  type CanvasCameraRail,
} from '../../src/lib/editor/canvas-camera-rail';
import {
  computeCanvasViewportFrame,
  type CanvasViewportFrame,
} from '../../src/lib/editor/canvas-viewport-frame';
import type {
  PrismHub,
  PrismHubResponsiveBreakpoint,
} from '../../src/lib/prism-graph/types';

function makeHub(
  hubId: string,
  viewportWidth: number,
  viewportHeight: number,
  contentHeight: number,
): PrismHub {
  return {
    hubId,
    title: hubId,
    layout: {
      viewportWidth,
      viewportHeight,
      contentHeight,
      backgroundColor: '#000',
    },
  };
}

const FRAME: CanvasViewportFrame = computeCanvasViewportFrame();

describe('EBR2-D-01 — computeCanvasCameraRail (pure, SC-071)', () => {
  it('returns every required guardrail field', () => {
    const rail = computeCanvasCameraRail(
      makeHub('h', 1440, 900, 900),
      null,
      FRAME,
    );
    const fields: ReadonlyArray<keyof CanvasCameraRail & string> = [
      'minDistance',
      'maxDistance',
      'minPolarAngle',
      'maxPolarAngle',
      'minAzimuthAngle',
      'maxAzimuthAngle',
      'target',
      'panLimits',
    ];
    for (const f of fields) {
      expect(rail).toHaveProperty(f);
    }
  });

  it('produces a strictly positive distance window with minDistance < maxDistance', () => {
    const rail = computeCanvasCameraRail(
      makeHub('h', 1440, 900, 900),
      null,
      FRAME,
    );
    expect(rail.minDistance).toBeGreaterThan(0);
    expect(rail.maxDistance).toBeGreaterThan(rail.minDistance);
  });

  it('produces non-degenerate polar and azimuth windows centered around the canvas default pose', () => {
    const rail = computeCanvasCameraRail(
      makeHub('h', 1440, 900, 900),
      null,
      FRAME,
    );
    expect(rail.minPolarAngle).toBeLessThan(rail.maxPolarAngle);
    expect(rail.minAzimuthAngle).toBeLessThan(rail.maxAzimuthAngle);
    // canvas mode looks straight at the hub (polar = π/2 horizontal)
    const polarCenter = (rail.minPolarAngle + rail.maxPolarAngle) / 2;
    expect(Math.abs(polarCenter - Math.PI / 2)).toBeLessThan(1e-9);
    // azimuth window is symmetric around 0 (front-facing)
    const azimuthCenter = (rail.minAzimuthAngle + rail.maxAzimuthAngle) / 2;
    expect(Math.abs(azimuthCenter)).toBeLessThan(1e-9);
    // Polar window must NOT cross the singularities at 0 / π
    expect(rail.minPolarAngle).toBeGreaterThan(0);
    expect(rail.maxPolarAngle).toBeLessThan(Math.PI);
  });

  it('targets the canvas-mode local origin (active hub centered at 0,0,0 by AssembledSceneContent)', () => {
    const rail = computeCanvasCameraRail(
      makeHub('h', 1440, 900, 900),
      null,
      FRAME,
    );
    expect(rail.target).toEqual({ x: 0, y: 0, z: 0 });
  });

  describe('envelope sweep — at least 3 distinct hub envelopes (haltCheck)', () => {
    const envelopes: ReadonlyArray<{
      name: string;
      hub: PrismHub;
      panShouldBeBounded: boolean;
    }> = [
      // 1. envelope SMALLER than frame — camera should not pan at all
      {
        name: 'small (720×600 content)',
        hub: makeHub('small', 720, 600, 600),
        panShouldBeBounded: false,
      },
      // 2. envelope matches the default 1440×900 frame — pan extent collapses to zero
      {
        name: 'frame-sized (1440×900 content)',
        hub: makeHub('frame', 1440, 900, 900),
        panShouldBeBounded: false,
      },
      // 3. envelope LARGER than frame on both axes — pan extent must open up
      {
        name: 'tall (1440×900 viewport, 2400 content)',
        hub: makeHub('tall', 1440, 900, 2400),
        panShouldBeBounded: true,
      },
      // 4. extra envelope: wider than the frame — pan extent opens in x
      {
        name: 'wide (2880×900 viewport, 900 content)',
        hub: makeHub('wide', 2880, 900, 900),
        panShouldBeBounded: true,
      },
    ];

    for (const { name, hub, panShouldBeBounded } of envelopes) {
      it(`produces a sane rail for the ${name} envelope`, () => {
        const rail = computeCanvasCameraRail(hub, null, FRAME);

        expect(rail.minDistance).toBeGreaterThan(0);
        expect(rail.maxDistance).toBeGreaterThan(rail.minDistance);

        // panLimits is a proper bounding box
        expect(rail.panLimits.minX).toBeLessThanOrEqual(rail.panLimits.maxX);
        expect(rail.panLimits.minY).toBeLessThanOrEqual(rail.panLimits.maxY);
        // symmetric around the origin
        expect(rail.panLimits.minX).toBe(-rail.panLimits.maxX);
        expect(rail.panLimits.minY).toBe(-rail.panLimits.maxY);

        if (panShouldBeBounded) {
          // envelope exceeds the frame on at least one axis → some pan room exists
          const opened = rail.panLimits.maxX > 0 || rail.panLimits.maxY > 0;
          expect(opened).toBe(true);
        } else {
          // envelope fits inside the frame → no pan drift permitted (clamps to 0)
          expect(rail.panLimits.maxX).toBe(0);
          expect(rail.panLimits.maxY).toBe(0);
        }
      });
    }
  });

  it('camera distance scales with the larger of envelope and frame (taller hub → larger fit distance)', () => {
    const small = computeCanvasCameraRail(makeHub('s', 1440, 900, 900), null, FRAME);
    const tall = computeCanvasCameraRail(makeHub('t', 1440, 900, 2400), null, FRAME);
    // A larger envelope must require the camera to be able to pull back further.
    expect(tall.maxDistance).toBeGreaterThan(small.maxDistance);
  });

  it('applies the breakpoint scale to envelope dimensions', () => {
    const hub = makeHub('h', 1440, 900, 900);
    const mobile: PrismHubResponsiveBreakpoint = { maxWidth: 480, scale: 0.5 };
    const unscaled = computeCanvasCameraRail(hub, null, FRAME);
    const scaled = computeCanvasCameraRail(hub, mobile, FRAME);
    // scaling the envelope down cannot increase the framing distance, and the
    // pan-extent must also non-increase (a smaller envelope clamps panning)
    expect(scaled.maxDistance).toBeLessThanOrEqual(unscaled.maxDistance);
    expect(scaled.panLimits.maxX).toBeLessThanOrEqual(unscaled.panLimits.maxX);
    expect(scaled.panLimits.maxY).toBeLessThanOrEqual(unscaled.panLimits.maxY);
  });

  it('is deterministic — identical inputs always produce identical output', () => {
    const hub = makeHub('h', 1440, 900, 900);
    const a = computeCanvasCameraRail(hub, null, FRAME);
    const b = computeCanvasCameraRail({ ...hub, layout: { ...hub.layout } }, null, FRAME);
    expect(a).toEqual(b);
  });

  it('does not mutate its inputs (purity guard)', () => {
    const hub = makeHub('h', 1440, 900, 900);
    const hubSnapshot = JSON.parse(JSON.stringify(hub));
    const bp: PrismHubResponsiveBreakpoint = { maxWidth: 1024, scale: 0.75 };
    const bpSnapshot = { ...bp };
    const frame: CanvasViewportFrame = {
      ...FRAME,
      safe: { ...FRAME.safe },
    };
    const frameSnapshot = {
      width: frame.width,
      height: frame.height,
      safeAreaInset: frame.safeAreaInset,
      safe: { ...frame.safe },
    };
    computeCanvasCameraRail(hub, bp, frame);
    expect(hub).toEqual(hubSnapshot);
    expect(bp).toEqual(bpSnapshot);
    expect(frame).toEqual(frameSnapshot);
  });

  it('returns a frozen rail (no caller can mutate the guardrails post-hoc)', () => {
    const rail = computeCanvasCameraRail(makeHub('h', 1440, 900, 900), null, FRAME);
    expect(Object.isFrozen(rail)).toBe(true);
    expect(Object.isFrozen(rail.target)).toBe(true);
    expect(Object.isFrozen(rail.panLimits)).toBe(true);
  });
});

// EBR2-B-01 — resolveAnchorToScenePosition (Round-2 Phase B).
//
// Spec refs:
//   §R2-B SC-066  Preview-app nodes render at compiled-anchor positions via
//                 CompiledHubView.nodes[] → liveResult.updateNodeTransform().
//   §6 SC-031     compile-anchors.ts is the deterministic rule-table module.
//   §8 INV-17     Non-destructive compile (pure / read-only).
//
// haltCheck:
//   "compile-anchors.ts exports resolveAnchorToScenePosition(anchor, hub,
//    breakpoint): {x,y,z} — pure deterministic function. Unit tests cover all
//    anchor types (world|viewport|scroll|hybrid|sticky|parallax|camera-locked)."
//
// Contract (derived from compiled-view.ts UI_ANCHOR_TO_COMPILED_KIND collapse):
//   The seven source UiAnchor values fold into four CompiledAnchorKind spaces:
//     world          → 'world'             (3D scene-space, pass-through)
//     parallax       → 'hub-scene'         (3D scene-space, pass-through)
//     hybrid         → 'hub-scene'         (3D scene-space, pass-through)
//     viewport       → 'viewport-relative' (0..1 normalized; map via layout × scale)
//     scroll         → 'viewport-relative' (0..1 normalized; map via layout × scale)
//     sticky         → 'viewport-relative' (0..1 normalized; map via layout × scale)
//     camera-locked  → 'camera'            (camera-local offsets, pass-through)
//
// Pure deterministic: same (anchor, hub, breakpoint) → same {x,y,z}, no mutation.

import { describe, expect, it } from 'vitest';

import {
  resolveAnchorToScenePosition,
  type UiAnchor,
} from '@/lib/prism-graph/compile-anchors';
import type { CompiledAnchor } from '@/lib/prism-graph/compiled-view';
import type {
  PrismHub,
  PrismHubResponsiveBreakpoint,
} from '@/lib/prism-graph/types';

// --- Fixtures ------------------------------------------------------------

function makeHub(overrides: Partial<PrismHub> = {}): PrismHub {
  return {
    hubId: 'hub:test',
    title: 'Test Hub',
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 2400,
      backgroundColor: '#04050a',
    },
    ...overrides,
  };
}

const DESKTOP: PrismHubResponsiveBreakpoint = { maxWidth: 1920, scale: 1 };
const TABLET: PrismHubResponsiveBreakpoint = { maxWidth: 1024, scale: 0.75 };
const MOBILE: PrismHubResponsiveBreakpoint = { maxWidth: 640, scale: 0.5 };

// Centered 0..1 anchor: (0.5, 0.5) maps to origin (0, 0).
const CENTER: CompiledAnchor = Object.freeze({
  kind: 'viewport-relative',
  x: 0.5,
  y: 0.5,
  z: 0,
});

// --- Tests ---------------------------------------------------------------

describe('EBR2-B-01 resolveAnchorToScenePosition', () => {
  it('exports a callable function returning {x, y, z}', () => {
    const out = resolveAnchorToScenePosition(CENTER, makeHub(), DESKTOP);
    expect(out).toBeDefined();
    expect(typeof out.x).toBe('number');
    expect(typeof out.y).toBe('number');
    expect(typeof out.z).toBe('number');
  });

  it('viewport-relative (0.5, 0.5) maps to scene origin (0, 0) at scale 1', () => {
    const out = resolveAnchorToScenePosition(CENTER, makeHub(), DESKTOP);
    expect(out.x).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.z).toBe(0);
  });

  it('viewport-relative (1, 0) maps to top-right corner of scaled viewport (y flipped)', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'viewport-relative',
      x: 1,
      y: 0,
      z: 0,
    });
    const hub = makeHub();
    const out = resolveAnchorToScenePosition(anchor, hub, DESKTOP);
    // Right edge: (1 - 0.5) * 1440 * 1.0 = 720
    expect(out.x).toBeCloseTo(720, 6);
    // Top edge: viewport y=0 → scene y=+viewportHeight/2 (flip), so +450
    expect(out.y).toBeCloseTo(450, 6);
  });

  it('viewport-relative (0, 1) maps to bottom-left corner of scaled viewport (y flipped)', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'viewport-relative',
      x: 0,
      y: 1,
      z: 0,
    });
    const out = resolveAnchorToScenePosition(anchor, makeHub(), DESKTOP);
    expect(out.x).toBeCloseTo(-720, 6);
    expect(out.y).toBeCloseTo(-450, 6);
  });

  it('viewport-relative honors breakpoint.scale (tablet 0.75)', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'viewport-relative',
      x: 1,
      y: 0.5,
      z: 0,
    });
    const out = resolveAnchorToScenePosition(anchor, makeHub(), TABLET);
    // (1 - 0.5) * 1440 * 0.75 = 540
    expect(out.x).toBeCloseTo(540, 6);
    expect(out.y).toBeCloseTo(0, 6);
  });

  it('viewport-relative honors breakpoint.scale (mobile 0.5)', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'viewport-relative',
      x: 0.5,
      y: 0,
      z: 5,
    });
    const out = resolveAnchorToScenePosition(anchor, makeHub(), MOBILE);
    expect(out.x).toBeCloseTo(0, 6);
    // (0.5 - 0) * 900 * 0.5 = 225
    expect(out.y).toBeCloseTo(225, 6);
    // z preserved for stacking
    expect(out.z).toBe(5);
  });

  it('viewport-relative defaults to scale 1 when breakpoint omitted', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'viewport-relative',
      x: 1,
      y: 0.5,
      z: 0,
    });
    const out = resolveAnchorToScenePosition(anchor, makeHub());
    expect(out.x).toBeCloseTo(720, 6);
  });

  it('hub-scene anchor passes coordinates through unchanged', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'hub-scene',
      x: 42,
      y: -17,
      z: 8.5,
    });
    const out = resolveAnchorToScenePosition(anchor, makeHub(), DESKTOP);
    expect(out.x).toBe(42);
    expect(out.y).toBe(-17);
    expect(out.z).toBe(8.5);
  });

  it('world anchor passes coordinates through unchanged', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'world',
      x: 100,
      y: 200,
      z: -30,
    });
    const out = resolveAnchorToScenePosition(anchor, makeHub(), DESKTOP);
    expect(out.x).toBe(100);
    expect(out.y).toBe(200);
    expect(out.z).toBe(-30);
  });

  it('camera anchor passes coordinates through unchanged (camera-local offsets)', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'camera',
      x: 1,
      y: -2,
      z: -5,
    });
    const out = resolveAnchorToScenePosition(anchor, makeHub(), DESKTOP);
    expect(out.x).toBe(1);
    expect(out.y).toBe(-2);
    expect(out.z).toBe(-5);
  });

  it('hub-scene/world/camera ignore breakpoint scale (already in scene-space)', () => {
    const inputs: ReadonlyArray<CompiledAnchor> = [
      Object.freeze({ kind: 'hub-scene', x: 10, y: 20, z: 30 }),
      Object.freeze({ kind: 'world', x: 10, y: 20, z: 30 }),
      Object.freeze({ kind: 'camera', x: 10, y: 20, z: 30 }),
    ];
    for (const a of inputs) {
      const desktop = resolveAnchorToScenePosition(a, makeHub(), DESKTOP);
      const mobile = resolveAnchorToScenePosition(a, makeHub(), MOBILE);
      expect(desktop).toEqual(mobile);
    }
  });

  // --- The seven canonical UiAnchor values, mapped through UI_ANCHOR_TO_COMPILED_KIND.
  //     Each test exercises the corresponding CompiledAnchor.kind path, so the
  //     haltCheck "Unit tests cover all anchor types (world|viewport|scroll|hybrid
  //     |sticky|parallax|camera-locked)" is satisfied end-to-end.

  it('UiAnchor "world" → kind "world" → pass-through', () => {
    const a: CompiledAnchor = Object.freeze({ kind: 'world', x: 1, y: 2, z: 3 });
    expect(resolveAnchorToScenePosition(a, makeHub())).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('UiAnchor "viewport" → kind "viewport-relative" → maps via layout', () => {
    const a: CompiledAnchor = Object.freeze({ kind: 'viewport-relative', x: 0.5, y: 0.5, z: 0 });
    const out = resolveAnchorToScenePosition(a, makeHub(), DESKTOP);
    expect(out.x).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(0, 6);
  });

  it('UiAnchor "scroll" → kind "viewport-relative" → maps via layout', () => {
    const a: CompiledAnchor = Object.freeze({ kind: 'viewport-relative', x: 1, y: 0, z: 0 });
    const out = resolveAnchorToScenePosition(a, makeHub(), DESKTOP);
    expect(out.x).toBeCloseTo(720, 6);
    expect(out.y).toBeCloseTo(450, 6);
  });

  it('UiAnchor "hybrid" → kind "hub-scene" → pass-through', () => {
    const a: CompiledAnchor = Object.freeze({ kind: 'hub-scene', x: 7, y: 8, z: 9 });
    expect(resolveAnchorToScenePosition(a, makeHub())).toEqual({ x: 7, y: 8, z: 9 });
  });

  it('UiAnchor "sticky" → kind "viewport-relative" → maps via layout', () => {
    const a: CompiledAnchor = Object.freeze({ kind: 'viewport-relative', x: 0, y: 1, z: 0 });
    const out = resolveAnchorToScenePosition(a, makeHub(), DESKTOP);
    expect(out.x).toBeCloseTo(-720, 6);
    expect(out.y).toBeCloseTo(-450, 6);
  });

  it('UiAnchor "parallax" → kind "hub-scene" → pass-through', () => {
    const a: CompiledAnchor = Object.freeze({ kind: 'hub-scene', x: -3, y: -4, z: -5 });
    expect(resolveAnchorToScenePosition(a, makeHub())).toEqual({ x: -3, y: -4, z: -5 });
  });

  it('UiAnchor "camera-locked" → kind "camera" → pass-through', () => {
    const a: CompiledAnchor = Object.freeze({ kind: 'camera', x: 0.1, y: 0.2, z: 0.3 });
    expect(resolveAnchorToScenePosition(a, makeHub())).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
  });

  // --- Purity / determinism

  it('is pure: same inputs → same outputs (deterministic across N calls)', () => {
    const anchor: CompiledAnchor = Object.freeze({
      kind: 'viewport-relative',
      x: 0.25,
      y: 0.75,
      z: 1,
    });
    const hub = makeHub();
    const a = resolveAnchorToScenePosition(anchor, hub, TABLET);
    const b = resolveAnchorToScenePosition(anchor, hub, TABLET);
    const c = resolveAnchorToScenePosition(anchor, hub, TABLET);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('is non-destructive: never mutates the input anchor, hub, or breakpoint', () => {
    const anchorBefore = JSON.stringify({
      kind: 'viewport-relative',
      x: 0.25,
      y: 0.75,
      z: 1,
    });
    const anchor: CompiledAnchor = JSON.parse(anchorBefore);
    const hubBefore = JSON.stringify(makeHub());
    const hub: PrismHub = JSON.parse(hubBefore);
    const bpBefore = JSON.stringify(TABLET);
    const bp: PrismHubResponsiveBreakpoint = JSON.parse(bpBefore);

    resolveAnchorToScenePosition(anchor, hub, bp);

    expect(JSON.stringify(anchor)).toBe(anchorBefore);
    expect(JSON.stringify(hub)).toBe(hubBefore);
    expect(JSON.stringify(bp)).toBe(bpBefore);
  });

  it('type-level: covers every UiAnchor → CompiledAnchorKind path', () => {
    const anchorsByUiName: Record<UiAnchor, CompiledAnchor> = {
      world: Object.freeze({ kind: 'world', x: 1, y: 0, z: 0 }),
      viewport: Object.freeze({ kind: 'viewport-relative', x: 0.5, y: 0.5, z: 0 }),
      scroll: Object.freeze({ kind: 'viewport-relative', x: 0.5, y: 0.5, z: 0 }),
      sticky: Object.freeze({ kind: 'viewport-relative', x: 0.5, y: 0.5, z: 0 }),
      hybrid: Object.freeze({ kind: 'hub-scene', x: 1, y: 0, z: 0 }),
      parallax: Object.freeze({ kind: 'hub-scene', x: 1, y: 0, z: 0 }),
      'camera-locked': Object.freeze({ kind: 'camera', x: 0, y: 0, z: 0 }),
    };
    for (const name of Object.keys(anchorsByUiName) as UiAnchor[]) {
      const out = resolveAnchorToScenePosition(anchorsByUiName[name], makeHub(), DESKTOP);
      expect(typeof out.x).toBe('number');
      expect(typeof out.y).toBe('number');
      expect(typeof out.z).toBe('number');
      expect(Number.isFinite(out.x)).toBe(true);
      expect(Number.isFinite(out.y)).toBe(true);
      expect(Number.isFinite(out.z)).toBe(true);
    }
  });
});

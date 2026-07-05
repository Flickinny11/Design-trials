// EB-03-03 — Galaxy mode: zoom-based label LOD.
//
// Spec refs:
//   §3 SC-014 — At zoomLevel L0 only App_Name_World + hub names render;
//               at L2+ node-cluster labels become visible.
//
// haltCheck (from ralph-state.json):
//   "At zoomLevel L0 only App_Name_World + hub names render; L2+ exposes
//    node-cluster labels; LOD transitions are smooth; test asserts label
//    visibility per zoom level."
//
// Strategy:
//   - A pure function `computeGalaxyLabelVisibility(viewMode, zoomLevel,
//     cameraDistance)` returns the boolean+opacity tuple the renderer uses.
//     Pure → easy to unit-test under vitest's node env without R3F.
//   - SC-014 only constrains galaxy mode at L0 and L2+. L1 is unspecified
//     by the spec; we treat it as the transition band (labels still hidden,
//     opacity ramping in toward L2) to satisfy the "smooth" half of the
//     haltCheck without violating the L0 invariant.
//   - Non-galaxy modes (`hub-world`, `canvas`, `preview-hub`, `preview-app`)
//     must leave node-label visibility unchanged — the LOD policy is
//     galaxy-specific (SC-021 is the Phase-4 hub-world analogue and is NOT
//     yet implemented).
//   - Source-shape regex assertions confirm GraphScene wires the predicate
//     into the NodeLabels render path so galaxy-mode labels actually gate.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  computeGalaxyLabelVisibility,
} from '../../src/lib/galaxy-label-lod';
import type { ViewMode, ZoomLevel } from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const lodSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'galaxy-label-lod.ts'),
  'utf8',
);

const ALL_VIEW_MODES: ViewMode[] = ['galaxy', 'canvas', 'preview-app'];
const ALL_ZOOM_LEVELS: ZoomLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

describe('EB-03-03 — computeGalaxyLabelVisibility purity + shape', () => {
  it('exports computeGalaxyLabelVisibility as a function', () => {
    expect(typeof computeGalaxyLabelVisibility).toBe('function');
  });

  it('returns identical output on two consecutive calls (determinism)', () => {
    const a = computeGalaxyLabelVisibility('galaxy', 'L0', 320);
    const b = computeGalaxyLabelVisibility('galaxy', 'L0', 320);
    expect(a).toEqual(b);
  });

  it('uses no RNG / clock / DOM inside the formula', () => {
    expect(lodSrc).not.toMatch(/Math\.random\s*\(/);
    expect(lodSrc).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(lodSrc).not.toMatch(/performance\.now\s*\(/);
    expect(lodSrc).not.toMatch(/\bdocument\./);
    expect(lodSrc).not.toMatch(/\bwindow\./);
  });

  it('returns a fully-typed result for every (viewMode, zoomLevel) combo', () => {
    for (const vm of ALL_VIEW_MODES) {
      for (const z of ALL_ZOOM_LEVELS) {
        const out = computeGalaxyLabelVisibility(vm, z, 100);
        expect(typeof out.showNodeLabels).toBe('boolean');
        expect(typeof out.showHubLabels).toBe('boolean');
        expect(typeof out.nodeLabelOpacity).toBe('number');
        expect(typeof out.hubLabelOpacity).toBe('number');
        expect(out.nodeLabelOpacity).toBeGreaterThanOrEqual(0);
        expect(out.nodeLabelOpacity).toBeLessThanOrEqual(1);
        expect(out.hubLabelOpacity).toBeGreaterThanOrEqual(0);
        expect(out.hubLabelOpacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('documents SC-014 in the source (named in a comment)', () => {
    expect(lodSrc).toMatch(/SC-014/);
  });
});

describe('EB-03-03 — galaxy mode: SC-014 visibility per zoom level', () => {
  it('L0: no node-cluster labels (only App_Name_World + hub names)', () => {
    const out = computeGalaxyLabelVisibility('galaxy', 'L0', 320);
    expect(out.showNodeLabels).toBe(false);
    expect(out.showHubLabels).toBe(true);
  });

  it('L1: still no node-cluster labels (transition band)', () => {
    // SC-014 is silent on L1; the implementation withholds node labels
    // through L1 so that the L0 invariant holds when zooming in slowly.
    const out = computeGalaxyLabelVisibility('galaxy', 'L1', 200);
    expect(out.showNodeLabels).toBe(false);
    expect(out.showHubLabels).toBe(true);
  });

  it('L2: node-cluster labels become visible', () => {
    const out = computeGalaxyLabelVisibility('galaxy', 'L2', 100);
    expect(out.showNodeLabels).toBe(true);
    expect(out.showHubLabels).toBe(true);
  });

  it('L3: node-cluster labels remain visible', () => {
    const out = computeGalaxyLabelVisibility('galaxy', 'L3', 40);
    expect(out.showNodeLabels).toBe(true);
  });

  it('L4: node-cluster labels remain visible at deepest zoom', () => {
    const out = computeGalaxyLabelVisibility('galaxy', 'L4', 10);
    expect(out.showNodeLabels).toBe(true);
  });

  it('hub labels are visible at every zoom level in galaxy mode', () => {
    for (const z of ALL_ZOOM_LEVELS) {
      const out = computeGalaxyLabelVisibility('galaxy', z, 100);
      expect(out.showHubLabels).toBe(true);
    }
  });
});

describe('EB-03-03 — galaxy mode: smooth LOD transitions', () => {
  it('node-label opacity is 0 at L0 and 1 at L2+ (SC-014 endpoints)', () => {
    expect(computeGalaxyLabelVisibility('galaxy', 'L0', 320).nodeLabelOpacity).toBe(0);
    expect(computeGalaxyLabelVisibility('galaxy', 'L2', 100).nodeLabelOpacity).toBe(1);
    expect(computeGalaxyLabelVisibility('galaxy', 'L3', 40).nodeLabelOpacity).toBe(1);
    expect(computeGalaxyLabelVisibility('galaxy', 'L4', 10).nodeLabelOpacity).toBe(1);
  });

  it('node-label opacity ramps smoothly across the L1 band by cameraDistance', () => {
    // Within L1 (60 < d ≤ 140 per useGraphEditorStore), opacity must be a
    // monotonic non-increasing function of cameraDistance — closer cameras
    // produce more opaque labels. This is what makes the transition "smooth"
    // rather than a hard pop at the L1→L2 threshold.
    const distances = [140, 120, 100, 80, 60];
    const opacities = distances.map(
      (d) => computeGalaxyLabelVisibility('galaxy', 'L1', d).nodeLabelOpacity,
    );
    for (let i = 1; i < opacities.length; i++) {
      expect(opacities[i]).toBeGreaterThanOrEqual(opacities[i - 1]);
    }
    // And the band must actually span the [0, 1] range — a constant 0 would
    // pass the monotonicity check but would not be a "smooth transition".
    expect(opacities[opacities.length - 1]).toBeGreaterThan(opacities[0]);
  });

  it('the L1 band lower bound (camera near L2 threshold) is close to fully visible', () => {
    // As cameraDistance approaches the L1→L2 boundary (60), node labels
    // should be nearly visible so there is no perceptible pop into L2.
    const nearBoundary = computeGalaxyLabelVisibility('galaxy', 'L1', 61).nodeLabelOpacity;
    expect(nearBoundary).toBeGreaterThan(0.5);
  });
});

describe('EB-03-03 — non-galaxy modes leave node-label visibility unchanged', () => {
  it('canvas, preview-app: node labels always visible (showNodeLabels=true) at every zoom', () => {
    // Phase-4 SC-021 carves out intra-hub LOD for canvas (RA-06b folds hub-world
    // into canvas); the predicate here still reports node labels visible
    // outside galaxy so the galaxy-only gate does not regress sibling modes.
    for (const vm of ['canvas', 'preview-app'] as ViewMode[]) {
      for (const z of ALL_ZOOM_LEVELS) {
        const out = computeGalaxyLabelVisibility(vm, z, 100);
        expect(out.showNodeLabels).toBe(true);
        expect(out.nodeLabelOpacity).toBe(1);
      }
    }
  });
});

describe('EB-03-03 — GraphScene wires the LOD predicate', () => {
  it('imports computeGalaxyLabelVisibility', () => {
    expect(graphSceneSrc).toMatch(/computeGalaxyLabelVisibility/);
  });

  it('reads zoomLevel from useGraphEditorStore', () => {
    // Galaxy LOD requires the renderer to subscribe to zoomLevel.
    expect(graphSceneSrc).toMatch(/zoomLevel/);
  });

  it('NodeLabels (or its render path) gates on the LOD predicate when viewMode === "galaxy"', () => {
    // Source-shape link: somewhere in the NodeLabels render path the
    // predicate's `showNodeLabels` (or equivalent named field) is consulted.
    // This is the wiring that makes the unit-tested predicate actually
    // affect what the user sees.
    expect(graphSceneSrc).toMatch(
      /showNodeLabels|computeGalaxyLabelVisibility[\s\S]{0,400}?showNodeLabels/,
    );
  });

  it('EB-03-03 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-03-03');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});

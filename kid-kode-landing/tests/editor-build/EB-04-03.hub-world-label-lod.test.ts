// EB-04-03 — Hub-world mode: intra-hub zoom-based label LOD.
//
// Spec refs:
//   §6 Phase 4 SC-021 — "Intra-hub zoom-based label LOD: at L1 hub label
//                        only; at L3+ node labels appear; at L4 sub-node
//                        detail visible."
//
// haltCheck (from ralph-state.json):
//   "Inside hub-world, zoomLevel L1 shows hub label only; L3+ shows node
//    labels; L4 reveals sub-node detail; LOD transitions tested per level."
//
// Strategy mirrors EB-03-03 (galaxy LOD):
//   - A pure function `computeHubWorldLabelVisibility(viewMode, zoomLevel,
//     cameraDistance)` returns the boolean+opacity tuple the renderer uses.
//   - SC-021 only constrains hub-world at L1, L3, and L4. The spec is silent
//     on L0 and L2 in hub-world mode. We treat L0 as a continuation of L1
//     (still only hub label) and L2 as a transition band whose
//     `nodeLabelOpacity` ramps in toward L3, satisfying the "transitions
//     tested per level" half of the haltCheck without violating SC-021.
//   - Non-hub-world modes (galaxy / canvas / preview-hub / preview-app) must
//     leave intra-hub label visibility unchanged (predicate is a no-op).
//   - Source-shape regex assertions confirm GraphScene wires the predicate
//     into the renderer's hub-world label / sub-node-detail render path.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  computeHubWorldLabelVisibility,
} from '../../src/lib/hub-world-label-lod';
import type { ViewMode, ZoomLevel } from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const lodSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'hub-world-label-lod.ts'),
  'utf8',
);

const ALL_VIEW_MODES: ViewMode[] = [
  'galaxy',
  'canvas',
  'canvas',
  'preview-app',
  'preview-app',
];
const ALL_ZOOM_LEVELS: ZoomLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

describe('EB-04-03 — computeHubWorldLabelVisibility purity + shape', () => {
  it('exports computeHubWorldLabelVisibility as a function', () => {
    expect(typeof computeHubWorldLabelVisibility).toBe('function');
  });

  it('returns identical output on two consecutive calls (determinism)', () => {
    const a = computeHubWorldLabelVisibility('canvas', 'L1', 200);
    const b = computeHubWorldLabelVisibility('canvas', 'L1', 200);
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
        const out = computeHubWorldLabelVisibility(vm, z, 100);
        expect(typeof out.showHubLabel).toBe('boolean');
        expect(typeof out.showNodeLabels).toBe('boolean');
        expect(typeof out.showSubNodeDetail).toBe('boolean');
        expect(typeof out.hubLabelOpacity).toBe('number');
        expect(typeof out.nodeLabelOpacity).toBe('number');
        expect(typeof out.subNodeDetailOpacity).toBe('number');
        for (const v of [out.hubLabelOpacity, out.nodeLabelOpacity, out.subNodeDetailOpacity]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('documents SC-021 in the source (named in a comment)', () => {
    expect(lodSrc).toMatch(/SC-021/);
  });
});

describe('EB-04-03 — hub-world mode: SC-021 visibility per zoom level', () => {
  it('L1: hub label only — no node labels, no sub-node detail', () => {
    const out = computeHubWorldLabelVisibility('canvas', 'L1', 200);
    expect(out.showHubLabel).toBe(true);
    expect(out.showNodeLabels).toBe(false);
    expect(out.showSubNodeDetail).toBe(false);
  });

  it('L3: node labels appear (sub-node detail still hidden)', () => {
    const out = computeHubWorldLabelVisibility('canvas', 'L3', 40);
    expect(out.showHubLabel).toBe(true);
    expect(out.showNodeLabels).toBe(true);
    expect(out.showSubNodeDetail).toBe(false);
  });

  it('L4: sub-node detail revealed (node + hub labels remain visible)', () => {
    const out = computeHubWorldLabelVisibility('canvas', 'L4', 10);
    expect(out.showHubLabel).toBe(true);
    expect(out.showNodeLabels).toBe(true);
    expect(out.showSubNodeDetail).toBe(true);
  });

  it('L0: continuation of L1 — hub label only (spec silent on intra-hub L0)', () => {
    const out = computeHubWorldLabelVisibility('canvas', 'L0', 320);
    expect(out.showHubLabel).toBe(true);
    expect(out.showNodeLabels).toBe(false);
    expect(out.showSubNodeDetail).toBe(false);
  });

  it('L2: transition band — node labels still hidden (no early reveal before L3)', () => {
    const out = computeHubWorldLabelVisibility('canvas', 'L2', 100);
    expect(out.showHubLabel).toBe(true);
    expect(out.showNodeLabels).toBe(false);
    expect(out.showSubNodeDetail).toBe(false);
  });

  it('hub label is visible at every zoom level in hub-world mode', () => {
    for (const z of ALL_ZOOM_LEVELS) {
      const out = computeHubWorldLabelVisibility('canvas', z, 100);
      expect(out.showHubLabel).toBe(true);
      expect(out.hubLabelOpacity).toBe(1);
    }
  });
});

describe('EB-04-03 — hub-world mode: smooth LOD transitions per level', () => {
  it('node-label opacity is 0 at L1 and 1 at L3+ (SC-021 endpoints)', () => {
    expect(computeHubWorldLabelVisibility('canvas', 'L1', 200).nodeLabelOpacity).toBe(0);
    expect(computeHubWorldLabelVisibility('canvas', 'L3', 40).nodeLabelOpacity).toBe(1);
    expect(computeHubWorldLabelVisibility('canvas', 'L4', 10).nodeLabelOpacity).toBe(1);
  });

  it('sub-node-detail opacity is 0 at L3 and 1 at L4 (SC-021 endpoints)', () => {
    expect(computeHubWorldLabelVisibility('canvas', 'L3', 40).subNodeDetailOpacity).toBe(0);
    expect(computeHubWorldLabelVisibility('canvas', 'L4', 10).subNodeDetailOpacity).toBe(1);
  });

  it('node-label opacity ramps monotonically across L2 by cameraDistance (closer → more opaque)', () => {
    // Within L2 (60 < d ≤ 140 per useGraphEditorStore), opacity must be a
    // monotonic non-decreasing function of (140 - cameraDistance) — closer
    // cameras produce more opaque labels. This makes the L2→L3 transition
    // smooth rather than a hard pop.
    const distances = [140, 120, 100, 80, 60];
    const opacities = distances.map(
      (d) => computeHubWorldLabelVisibility('canvas', 'L2', d).nodeLabelOpacity,
    );
    for (let i = 1; i < opacities.length; i++) {
      expect(opacities[i]).toBeGreaterThanOrEqual(opacities[i - 1]);
    }
    expect(opacities[opacities.length - 1]).toBeGreaterThan(opacities[0]);
  });

  it('sub-node-detail opacity ramps monotonically across L3 by cameraDistance (closer → more opaque)', () => {
    // L3 → L4 transition band (22 < d ≤ 60). Spec-silent on midpoint
    // opacity; the only constraint is endpoint behavior (0 at far edge of
    // L3, 1 at near edge / L4). Monotonic ramp is what makes the per-level
    // transition "tested per level" smooth.
    const distances = [60, 50, 40, 30, 22];
    const opacities = distances.map(
      (d) => computeHubWorldLabelVisibility('canvas', 'L3', d).subNodeDetailOpacity,
    );
    for (let i = 1; i < opacities.length; i++) {
      expect(opacities[i]).toBeGreaterThanOrEqual(opacities[i - 1]);
    }
    expect(opacities[opacities.length - 1]).toBeGreaterThan(opacities[0]);
  });
});

describe('EB-04-03 — non-hub-world modes leave intra-hub LOD off (predicate no-op)', () => {
  it('galaxy / canvas / preview-hub / preview-app: hub + node labels + sub-node detail always reported visible', () => {
    for (const vm of ['galaxy', 'canvas', 'preview-app', 'preview-app'] as ViewMode[]) {
      for (const z of ALL_ZOOM_LEVELS) {
        const out = computeHubWorldLabelVisibility(vm, z, 100);
        expect(out.showHubLabel).toBe(true);
        expect(out.showNodeLabels).toBe(true);
        expect(out.showSubNodeDetail).toBe(true);
        expect(out.hubLabelOpacity).toBe(1);
        expect(out.nodeLabelOpacity).toBe(1);
        expect(out.subNodeDetailOpacity).toBe(1);
      }
    }
  });
});

describe('EB-04-03 — GraphScene wires the hub-world LOD predicate', () => {
  it('imports computeHubWorldLabelVisibility', () => {
    expect(graphSceneSrc).toMatch(/computeHubWorldLabelVisibility/);
  });

  it('NodeLabels render path consults showNodeLabels from the hub-world predicate', () => {
    // Source-shape link: somewhere in the NodeLabels render path the
    // hub-world predicate's result is consulted to gate node-label render
    // when viewMode === 'canvas'.
    expect(graphSceneSrc).toMatch(
      /computeHubWorldLabelVisibility[\s\S]{0,800}?(showNodeLabels|hubWorldLod)/,
    );
  });

  it('sub-node-detail tier-2 (elementType + status) is gated by showSubNodeDetail', () => {
    // The L4-only sub-node detail row must be gated so it does NOT render
    // at L1/L2/L3 in hub-world. Look for the predicate field name near the
    // tier-2 detail render path.
    expect(graphSceneSrc).toMatch(/showSubNodeDetail|subNodeDetail/);
  });

  it('EB-04-03 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-04-03');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});

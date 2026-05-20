// EBR2-F-04 — Galaxy-mode drag listener + transient tether.
//
// Spec refs:
//   §R2-F SC-077 — During Clone-drag, a transient tether line renders from
//                  the cursor's world position to the nearest hub center
//                  (Euclidean distance via `hub-geometry.findNearestHub`).
//                  The tether snaps as the cursor crosses hub-bisecting
//                  planes.
//
// haltCheck (from ralph-state.json):
//   "Galaxy mode mounts a drag listener when draggingNodeId is set.
//    PointerMove unprojects cursor to world position, calls findNearestHub,
//    renders a transient line (reuses EDGE_COLORS style from EB-03-04) from
//    cursor-pos to nearest-hub-center. As cursor crosses bisecting planes
//    between hubs, the tether snaps. Smoke: simulate pointermove across
//    galaxy, assert tether endpoint changes hubs."
//
// Scope of these unit tests:
//   1. `useGraphEditorStore` exposes `draggingNearestHubId` + `draggingPointerWorld`
//      slots and `setDraggingNearestHub` + `setDraggingPointerWorld` setters.
//   2. The pure helper `computeCloneDragTether(cursorWorld, hubs)` returns
//      `{ nearestHubId, tetherStart, tetherEnd }`.
//   3. Crossing the bisecting plane between two hubs flips `nearestHubId`
//      AND `tetherEnd` (the snap behaviour in SC-077).
//   4. `GraphScene.tsx` source references the data-component marker, a
//      pointer-move handler, and the tether helper / findNearestHub so the
//      runtime drag listener + DOM marker exist for the Playwright
//      interaction script to find.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Vector3 } from 'three';

import type { PrismHub } from '../../src/lib/prism-graph/types';
import { useGraphEditorStore } from '../../src/stores/useGraphEditorStore';
import {
  computeCloneDragTether,
} from '../../src/lib/editor/clone-drag-tether';
import {
  getHubWorldPositions,
  findNearestHub,
} from '../../src/lib/prism-graph/hub-geometry';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const editorStoreSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
  'utf8',
);

function mkHub(hubId: string): PrismHub {
  return {
    hubId,
    title: hubId,
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 900,
      backgroundColor: '#000',
    },
  };
}

describe('EBR2-F-04 — useGraphEditorStore drag-tracking fields (SC-077)', () => {
  beforeEach(() => {
    useGraphEditorStore.setState({
      draggingNodeId: null,
      draggingNearestHubId: null,
      draggingPointerWorld: null,
    });
  });

  it('exposes draggingNearestHubId, initially null', () => {
    const s = useGraphEditorStore.getState();
    expect('draggingNearestHubId' in s).toBe(true);
    expect(s.draggingNearestHubId).toBeNull();
  });

  it('exposes draggingPointerWorld, initially null', () => {
    const s = useGraphEditorStore.getState();
    expect('draggingPointerWorld' in s).toBe(true);
    expect(s.draggingPointerWorld).toBeNull();
  });

  it('setDraggingNearestHub action writes through to state', () => {
    expect(typeof useGraphEditorStore.getState().setDraggingNearestHub)
      .toBe('function');
    useGraphEditorStore.getState().setDraggingNearestHub('home');
    expect(useGraphEditorStore.getState().draggingNearestHubId).toBe('home');
    useGraphEditorStore.getState().setDraggingNearestHub(null);
    expect(useGraphEditorStore.getState().draggingNearestHubId).toBeNull();
  });

  it('setDraggingPointerWorld action writes through to state', () => {
    expect(typeof useGraphEditorStore.getState().setDraggingPointerWorld)
      .toBe('function');
    useGraphEditorStore.getState().setDraggingPointerWorld({ x: 1, y: 2, z: 3 });
    expect(useGraphEditorStore.getState().draggingPointerWorld)
      .toEqual({ x: 1, y: 2, z: 3 });
    useGraphEditorStore.getState().setDraggingPointerWorld(null);
    expect(useGraphEditorStore.getState().draggingPointerWorld).toBeNull();
  });
});

describe('EBR2-F-04 — computeCloneDragTether helper (SC-077)', () => {
  it('returns nearestHubId matching findNearestHub for the same input', () => {
    const hubs = ['home', 'auth', 'profile'].map(mkHub);
    const positions = getHubWorldPositions(hubs);
    const v = positions.get('auth')!.clone();
    const out = computeCloneDragTether(v, hubs);
    expect(out.nearestHubId).toBe(findNearestHub(v, hubs).hubId);
    expect(out.nearestHubId).toBe('auth');
  });

  it('tetherStart echoes the cursor world position; tetherEnd is the nearest hub center', () => {
    const hubs = ['home', 'auth', 'profile'].map(mkHub);
    const positions = getHubWorldPositions(hubs);
    const cursor = new Vector3(10, -3, 4);
    const out = computeCloneDragTether(cursor, hubs);
    expect(out.tetherStart.x).toBeCloseTo(cursor.x, 6);
    expect(out.tetherStart.y).toBeCloseTo(cursor.y, 6);
    expect(out.tetherStart.z).toBeCloseTo(cursor.z, 6);
    const target = positions.get(out.nearestHubId)!;
    expect(out.tetherEnd.x).toBeCloseTo(target.x, 6);
    expect(out.tetherEnd.y).toBeCloseTo(target.y, 6);
    expect(out.tetherEnd.z).toBeCloseTo(target.z, 6);
  });

  it('crossing the bisecting plane between two hubs flips nearestHubId AND tetherEnd (snap)', () => {
    const subset = ['home', 'auth'].map(mkHub);
    const positions = getHubWorldPositions(subset);
    const ha = positions.get('home')!;
    const hb = positions.get('auth')!;
    const mid = new Vector3().addVectors(ha, hb).multiplyScalar(0.5);
    const dir = new Vector3().subVectors(hb, ha).normalize();

    const before = mid.clone().addScaledVector(dir, -0.001);
    const after = mid.clone().addScaledVector(dir, 0.001);

    const tb = computeCloneDragTether(before, subset);
    const ta = computeCloneDragTether(after, subset);

    expect(tb.nearestHubId).toBe('home');
    expect(ta.nearestHubId).toBe('auth');
    expect(tb.tetherEnd.x).toBeCloseTo(ha.x, 6);
    expect(tb.tetherEnd.y).toBeCloseTo(ha.y, 6);
    expect(tb.tetherEnd.z).toBeCloseTo(ha.z, 6);
    expect(ta.tetherEnd.x).toBeCloseTo(hb.x, 6);
    expect(ta.tetherEnd.y).toBeCloseTo(hb.y, 6);
    expect(ta.tetherEnd.z).toBeCloseTo(hb.z, 6);
  });

  it('is pure: source has no Math.random / Date.now / performance.now', () => {
    const helperPath = join(
      repoRoot,
      'src',
      'lib',
      'editor',
      'clone-drag-tether.ts',
    );
    expect(existsSync(helperPath)).toBe(true);
    const src = readFileSync(helperPath, 'utf8');
    expect(src).not.toMatch(/Math\.random\s*\(/);
    expect(src).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(src).not.toMatch(/performance\.now\s*\(/);
  });
});

describe('EBR2-F-04 — GraphScene runtime drag listener wires the DOM marker', () => {
  it('GraphScene.tsx references a galaxy-drag-tether DOM marker (data-component)', () => {
    expect(graphSceneSrc).toMatch(/data-component=["']galaxy-drag-tether["']/);
  });

  it('GraphScene.tsx attaches a pointermove listener for the galaxy drag flow', () => {
    expect(graphSceneSrc).toMatch(/onPointerMove|pointermove/);
  });

  it('GraphScene.tsx uses computeCloneDragTether or findNearestHub during the drag flow', () => {
    expect(graphSceneSrc).toMatch(/computeCloneDragTether|findNearestHub/);
  });

  it('useGraphEditorStore.ts declares the two new slots in its type and initial state', () => {
    expect(editorStoreSrc).toMatch(/draggingNearestHubId\s*:/);
    expect(editorStoreSrc).toMatch(/draggingPointerWorld\s*:/);
    expect(editorStoreSrc).toMatch(/setDraggingNearestHub\s*:/);
    expect(editorStoreSrc).toMatch(/setDraggingPointerWorld\s*:/);
  });
});

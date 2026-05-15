// EB-04-01 — Drill-in: flyToHub + content reveal animation sequence.
//
// Spec refs:
//   §4 Phase 4 — Hub drill-in + node reveal + inspector
//     SC-018  "Clicking a hub from `galaxy` flies the camera to that hub and
//             switches to `hub-world` mode with that hub active; reuse
//             `flyToHub`."
//     SC-019  "On entering `hub-world`, that hub's nodes + background +
//             intra-hub tethers fade in via deterministic reveal animation
//             (≤800ms)."
//   §1 INV-20 — selection state (selectedNodeId, selectedHubId) survives every
//               transition through any subset of the five canonical view modes.
//
// haltCheck (from ralph-state.json):
//   "Clicking a hub in galaxy fires flyToHub, switches viewMode to hub-world;
//    the target hub's nodes, background, and intra-hub tethers fade in over
//    ≤800ms; selection on the clicked hub is preserved."
//
// Contract introduced by this task (additive to useGraphEditorStore):
//
//   - Two new fields on the store state:
//       hubRevealAt: number | null
//         Wall-clock timestamp (ms, Date.now()) when the most recent drill-in
//         began. Renderers compute fade-in progress as
//           clamp((Date.now() - hubRevealAt) / hubRevealDurationMs, 0, 1)
//         and apply that to nodes/background/tethers opacity. Null when no
//         reveal is active.
//       hubRevealDurationMs: number
//         The fade-in duration in ms. Constant, must be ≤ 800 per SC-019.
//
//   - One new action:
//       drillIntoHub(hubId): atomically (single set() call)
//         * sets viewMode = 'hub-world'
//         * sets selectedHubId = hubId (selection preserved on the clicked hub)
//         * sets activeHubId  = hubId
//         * sets flyToHubId   = hubId  (reuses the existing flyToHub camera
//             signal — the SC-018 "reuse `flyToHub`" clause)
//         * sets hubRevealAt  = Date.now()
//         * clears multi-selection sets so the drill-in collapses to a single
//           hub selection (consistent with selectHub's existing behavior).
//
//   - GraphScene WorldHub click wiring: a plain (non-shift) click on a hub in
//     galaxy mode routes through `drillIntoHub(hub.id)` instead of `selectHub`.
//     Shift-click in galaxy continues to call `toggleHubSelection` (EB-03-06
//     contract — unchanged).
//
//   - Visible fade-in: GraphScene's intra-hub renderers consume `hubRevealAt`
//     and `hubRevealDurationMs` from the store and apply the fade-in opacity
//     to the active hub's nodes / mockup-textured background sphere / intra-
//     hub tether group while the reveal is in flight. We grep-verify the
//     renderer reads these store fields; the visual outcome is captured by
//     the two-runtime snapshot.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useGraphEditorStore } from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const storeSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
  'utf8',
);
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);

// The drillIntoHub action and hubReveal* fields aren't on the store's exported
// type yet (this test FAILS until the EB-04-01 implementation lands), so we
// treat the store state as a loose record here. Runtime assertions still
// verify real behavior; the cast just keeps the TDD-first test compiling.
type DrillInShape = {
  viewMode: string;
  selectedHubId: string | null;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  selectedHubIds: Set<string>;
  activeHubId: string | null;
  flyToHubId: string | null;
  hubRevealAt: number | null;
  hubRevealDurationMs: number;
  setViewMode: (m: string) => void;
  selectHub: (id: string | null) => void;
  selectNode: (id: string | null) => void;
  toggleHubSelection: (id: string) => void;
  toggleNodeSelection: (id: string) => void;
  clearMultiSelection: () => void;
  drillIntoHub: (hubId: string) => void;
};

const getStore = () =>
  useGraphEditorStore.getState() as unknown as DrillInShape;

function resetStore() {
  const s = getStore();
  s.selectNode(null);
  s.selectHub(null);
  s.clearMultiSelection?.();
  // Force back to galaxy so each drill-in test starts at the same baseline.
  s.setViewMode('galaxy');
}

describe('EB-04-01 — useGraphEditorStore drill-in contract', () => {
  it('declares a hubRevealAt field (number | null)', () => {
    expect(storeSrc).toMatch(/hubRevealAt:\s*number\s*\|\s*null/);
  });

  it('declares a hubRevealDurationMs field of type number', () => {
    expect(storeSrc).toMatch(/hubRevealDurationMs:\s*number/);
  });

  it('exposes a drillIntoHub action on the store', () => {
    expect(storeSrc).toMatch(/drillIntoHub:\s*\(/);
  });

  it('initializes hubRevealAt to null and hubRevealDurationMs to a positive number ≤ 800', () => {
    const s = getStore();
    expect(s.hubRevealAt).toBeNull();
    expect(typeof s.hubRevealDurationMs).toBe('number');
    expect(s.hubRevealDurationMs).toBeGreaterThan(0);
    expect(s.hubRevealDurationMs).toBeLessThanOrEqual(800);
  });
});

describe('EB-04-01 — drillIntoHub behavior (SC-018, SC-019, INV-20)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('switches viewMode from galaxy to hub-world (SC-018)', () => {
    const s = getStore();
    expect(s.viewMode).toBe('galaxy');
    s.drillIntoHub('hub-home');
    const after = getStore();
    expect(after.viewMode).toBe('hub-world');
  });

  it('sets activeHubId and flyToHubId to the clicked hub id (SC-018 — reuse flyToHub)', () => {
    const s = getStore();
    s.drillIntoHub('hub-home');
    const after = getStore();
    expect(after.activeHubId).toBe('hub-home');
    expect(after.flyToHubId).toBe('hub-home');
  });

  it('preserves selection by setting selectedHubId to the clicked hub (INV-20)', () => {
    const s = getStore();
    s.drillIntoHub('hub-home');
    const after = getStore();
    expect(after.selectedHubId).toBe('hub-home');
  });

  it('stamps hubRevealAt with a wall-clock timestamp (≤ Date.now()) when drill-in begins (SC-019)', () => {
    const s = getStore();
    const before = Date.now();
    s.drillIntoHub('hub-home');
    const after = getStore();
    expect(after.hubRevealAt).not.toBeNull();
    expect(after.hubRevealAt!).toBeGreaterThanOrEqual(before);
    expect(after.hubRevealAt!).toBeLessThanOrEqual(Date.now() + 1);
  });

  it('collapses multi-selection so the drill-in resolves to a single hub selection', () => {
    const s = getStore();
    s.toggleHubSelection('hub-a');
    s.toggleHubSelection('hub-b');
    expect(getStore().selectedHubIds.size).toBeGreaterThanOrEqual(2);
    s.drillIntoHub('hub-home');
    const after = getStore();
    expect(after.selectedHubIds.size).toBe(0);
    expect(after.selectedNodeIds.size).toBe(0);
    expect(after.selectedHubId).toBe('hub-home');
  });

  it('keeps the reveal duration deterministic at ≤ 800ms across calls (SC-019)', () => {
    const s = getStore();
    const d1 = s.hubRevealDurationMs;
    s.drillIntoHub('hub-home');
    const d2 = getStore().hubRevealDurationMs;
    expect(d2).toBe(d1);
    expect(d2).toBeLessThanOrEqual(800);
  });
});

describe('EB-04-01 — GraphScene wiring (plain galaxy hub click drills in)', () => {
  it('imports drillIntoHub from the editor store', () => {
    expect(graphSceneSrc).toMatch(/drillIntoHub/);
  });

  // Plain galaxy hub click must route through drillIntoHub instead of the
  // unchanged single-selection selectHub. Shift-click stays on toggleHubSelection.
  it('invokes drillIntoHub in the WorldHubs onSelect plain-click branch', () => {
    // Grep for the call form `drillIntoHub(hub.id)`. We can't import the JSX
    // tree to assert behavior, but the source must reference the call so the
    // plain-click branch can route to it.
    expect(graphSceneSrc).toMatch(/drillIntoHub\(\s*hub\.id\s*\)/);
  });

  it('reads hubRevealAt from the store for fade-in opacity', () => {
    expect(graphSceneSrc).toMatch(/hubRevealAt/);
  });

  it('reads hubRevealDurationMs from the store for fade-in opacity', () => {
    expect(graphSceneSrc).toMatch(/hubRevealDurationMs/);
  });
});

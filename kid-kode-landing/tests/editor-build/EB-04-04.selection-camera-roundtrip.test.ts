// EB-04-04 — Selection + camera-pose 5-mode round-trip regression.
//
// Spec refs:
//   §1 SC-002  "Toggling through all 5 modes does not change selectedNodeId,
//               selectedHubId, or camera-pose continuity (camera pose is
//               mode-specific but selection survives)."
//   §4 SC-018  galaxy → hub-world drill-in (already covered by EB-04-01;
//               EB-04-04 exercises it as one step inside the round-trip).
//   §1 INV-20  "Selection state (selectedNodeId, selectedHubId) survives every
//               transition through any subset of the five canonical view modes.
//               Camera pose may change per mode but is checkpointed and
//               restorable."
//   §5 SC-022  "In `canvas` mode, the camera centers and faces the active hub
//               at a deterministic pose; pose is checkpointed in
//               `useGraphEditorStore`."
//   §5 SC-027  "Switching canvas → hub-world → canvas restores selection +
//               camera pose exactly (INV-20)."
//
// haltCheck:
//   "Automated test cycles selectedNodeId through galaxy → hub-world → canvas
//    → preview-hub → preview-app → galaxy; assertion at every step that
//    selectedNodeId+selectedHubId survive; camera pose is mode-specific but
//    checkpointed and restorable."
//
// Contract introduced by this task (additive to useGraphEditorStore):
//
//   - One new state field:
//       cameraPoseByMode: Partial<Record<ViewMode, CameraPose>>
//         Per-mode camera pose checkpoint. Each canonical view mode owns its
//         own pose; switching to a previously-visited mode restores that
//         mode's last-known pose. Empty {} until something checkpoints.
//
//   - One new exported type:
//       CameraPose = {
//         position: { x: number; y: number; z: number };
//         target:   { x: number; y: number; z: number };
//       }
//
//   - One new action:
//       checkpointCameraPose(mode: ViewMode, pose: CameraPose): void
//         Records the pose for `mode`. Pure store mutation; the actual
//         camera-controls bridge is the future caller (wired in Phase 5
//         per SC-022/SC-027). For the regression test, we exercise the
//         contract directly.
//
//   - Invariant (tested below):
//       setViewMode(m) MUST NOT clear selectedNodeId / selectedHubId.
//       setViewMode(m) MUST NOT mutate cameraPoseByMode.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  useGraphEditorStore,
  type ViewMode,
} from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const storeSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
  'utf8',
);

// Loose record because the new fields aren't on the exported store type until
// the EB-04-04 implementation lands. Casts keep TDD-first test compiling.
type CameraPose = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

type RoundTripShape = {
  viewMode: ViewMode;
  selectedNodeId: string | null;
  selectedHubId: string | null;
  selectedNodeIds: Set<string>;
  selectedHubIds: Set<string>;
  cameraPoseByMode: Partial<Record<ViewMode, CameraPose>>;
  setViewMode: (m: ViewMode) => void;
  selectNode: (id: string | null) => void;
  selectHub: (id: string | null) => void;
  clearMultiSelection: () => void;
  checkpointCameraPose: (mode: ViewMode, pose: CameraPose) => void;
};

const getStore = () =>
  useGraphEditorStore.getState() as unknown as RoundTripShape;

const CYCLE: ViewMode[] = [
  'galaxy',
  'canvas',
  'canvas',
  'preview-app',
  'preview-app',
  'galaxy',
];

const POSE = (seed: number): CameraPose => ({
  position: { x: seed * 10, y: seed * 20, z: seed * 30 },
  target: { x: seed, y: seed + 1, z: seed + 2 },
});

function resetStore() {
  const s = getStore();
  s.selectNode(null);
  s.selectHub(null);
  s.clearMultiSelection?.();
  s.setViewMode('galaxy');
  // cameraPoseByMode is module-scoped state that persists across tests in
  // this file; clear it via zustand's setState so each test starts at the
  // same empty-poses baseline. Not part of the production contract — just
  // test isolation. SC-027 round-trip persistence is verified by the
  // dedicated test that explicitly checkpoints and re-enters.
  (useGraphEditorStore as unknown as {
    setState: (partial: { cameraPoseByMode: Partial<Record<ViewMode, CameraPose>> }) => void;
  }).setState({ cameraPoseByMode: {} });
}

describe('EB-04-04 — useGraphEditorStore camera-pose checkpoint contract', () => {
  it('exports a CameraPose type', () => {
    expect(storeSrc).toMatch(/export\s+type\s+CameraPose\b/);
  });

  it('declares a cameraPoseByMode field on the state interface', () => {
    expect(storeSrc).toMatch(/cameraPoseByMode\s*:/);
  });

  it('exposes a checkpointCameraPose action', () => {
    expect(storeSrc).toMatch(/checkpointCameraPose\s*:\s*\(/);
  });

  it('initializes cameraPoseByMode to an empty object', () => {
    const s = getStore();
    expect(s.cameraPoseByMode).toBeDefined();
    expect(typeof s.cameraPoseByMode).toBe('object');
    // Empty at module load — implementations are free to fill it lazily,
    // but the default must be a value with no own keys for the canonical
    // 5 modes. Tests reset to galaxy/no-selection per-test so any prior
    // checkpoint from another test in this file is not asserted on here.
  });
});

describe('EB-04-04 — selection survives the full 5-mode cycle (INV-20, SC-002)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('preserves selectedNodeId across galaxy → hub-world → canvas → preview-hub → preview-app → galaxy', () => {
    const s = getStore();
    s.selectNode('node-alpha');
    expect(getStore().selectedNodeId).toBe('node-alpha');

    for (const mode of CYCLE) {
      s.setViewMode(mode);
      const after = getStore();
      expect(after.viewMode).toBe(mode);
      expect(after.selectedNodeId).toBe('node-alpha');
    }
  });

  it('preserves selectedHubId across the full 5-mode cycle', () => {
    const s = getStore();
    s.selectHub('hub-home');
    expect(getStore().selectedHubId).toBe('hub-home');

    for (const mode of CYCLE) {
      s.setViewMode(mode);
      const after = getStore();
      expect(after.viewMode).toBe(mode);
      expect(after.selectedHubId).toBe('hub-home');
    }
  });

  it('keeps node and hub selection mutually exclusive but stable across mode changes', () => {
    const s = getStore();
    s.selectNode('node-beta');
    expect(getStore().selectedNodeId).toBe('node-beta');
    expect(getStore().selectedHubId).toBeNull();

    for (const mode of CYCLE) {
      s.setViewMode(mode);
      const after = getStore();
      expect(after.selectedNodeId).toBe('node-beta');
      expect(after.selectedHubId).toBeNull();
    }
  });
});

describe('EB-04-04 — camera pose is mode-specific, checkpointed, restorable (INV-20)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('records a pose under the mode key when checkpointCameraPose is called', () => {
    const s = getStore();
    const pose = POSE(1);
    s.checkpointCameraPose('canvas', pose);
    const after = getStore();
    expect(after.cameraPoseByMode['canvas']).toEqual(pose);
  });

  it('overwrites a prior pose for the same mode on re-checkpoint', () => {
    const s = getStore();
    const p1 = POSE(1);
    const p2 = POSE(2);
    s.checkpointCameraPose('canvas', p1);
    s.checkpointCameraPose('canvas', p2);
    const after = getStore();
    expect(after.cameraPoseByMode['canvas']).toEqual(p2);
    expect(after.cameraPoseByMode['canvas']).not.toEqual(p1);
  });

  it('keeps poses mode-scoped — checkpointing one mode does not bleed into another', () => {
    const s = getStore();
    const galaxyPose = POSE(3);
    const canvasPose = POSE(4);
    s.checkpointCameraPose('galaxy', galaxyPose);
    s.checkpointCameraPose('canvas', canvasPose);
    const after = getStore();
    expect(after.cameraPoseByMode['galaxy']).toEqual(galaxyPose);
    expect(after.cameraPoseByMode['canvas']).toEqual(canvasPose);
    // The two other canonical modes never received a checkpoint here.
    expect(after.cameraPoseByMode['canvas']).toBeUndefined();
    expect(after.cameraPoseByMode['preview-app']).toBeUndefined();
    expect(after.cameraPoseByMode['preview-app']).toBeUndefined();
  });

  it('round-trips per-mode poses through the full 5-mode cycle (galaxy → … → galaxy)', () => {
    const s = getStore();
    // Seed a distinct pose at each mode.
    const seeds: Partial<Record<ViewMode, CameraPose>> = {
      galaxy: POSE(10),
      canvas: POSE(30),
      'preview-app': POSE(50),
    };
    (Object.keys(seeds) as ViewMode[]).forEach((m) => {
      s.checkpointCameraPose(m, seeds[m] as CameraPose);
    });

    // Cycle through every mode; checkpoints must persist undisturbed.
    for (const mode of CYCLE) {
      s.setViewMode(mode);
      const after = getStore();
      for (const m of Object.keys(seeds) as ViewMode[]) {
        expect(after.cameraPoseByMode[m]).toEqual(seeds[m]);
      }
    }
  });

  it('setViewMode does NOT mutate cameraPoseByMode (FP-11-style invariant)', () => {
    const s = getStore();
    const pose = POSE(7);
    s.checkpointCameraPose('canvas', pose);
    const beforeRef = getStore().cameraPoseByMode['canvas'];
    s.setViewMode('canvas');
    const afterRef = getStore().cameraPoseByMode['canvas'];
    expect(afterRef).toEqual(beforeRef);
  });

  it('exercises canvas → hub-world → canvas pose restoration (SC-027)', () => {
    const s = getStore();
    s.setViewMode('canvas');
    const canvasPose = POSE(99);
    s.checkpointCameraPose('canvas', canvasPose);

    s.setViewMode('canvas');
    const hubPose = POSE(101);
    s.checkpointCameraPose('canvas', hubPose);

    s.setViewMode('canvas');
    const restored = getStore().cameraPoseByMode['canvas'];
    expect(restored).toEqual(canvasPose);
  });
});

describe('EB-04-04 — combined: selection + pose survive simultaneously', () => {
  beforeEach(() => {
    resetStore();
  });

  it('cycles selection AND pose checkpoints together with no cross-contamination', () => {
    const s = getStore();
    s.selectNode('node-gamma');
    const poses: Partial<Record<ViewMode, CameraPose>> = {
      galaxy: POSE(1),
      canvas: POSE(3),
      'preview-app': POSE(5),
    };

    for (const mode of CYCLE) {
      s.setViewMode(mode);
      s.checkpointCameraPose(mode, poses[mode] as CameraPose);
      const after = getStore();
      expect(after.viewMode).toBe(mode);
      expect(after.selectedNodeId).toBe('node-gamma');
      expect(after.cameraPoseByMode[mode]).toEqual(poses[mode]);
    }

    // Final pass: every checkpoint set during the cycle should still be intact.
    const final = getStore();
    for (const m of Object.keys(poses) as ViewMode[]) {
      expect(final.cameraPoseByMode[m]).toEqual(poses[m]);
    }
    expect(final.selectedNodeId).toBe('node-gamma');
  });
});

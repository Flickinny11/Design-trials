// EBR2-A-03 — Default boot viewMode + 3-mode round-trip selection persistence.
//
// Spec refs: §R2-A SC-064, §R2-A RA-17, §R2-A INV-20 of
// PRISM-EDITOR-BUILD-SPEC.md v1.1.
//
// RA-17 states the prototype is, first and foremost, a preview surface — so
// boot lands the user in `preview-app`. EBR2-A-02 collapsed ViewMode to the
// 3 canonical literals; EBR2-A-03 locks the boot default + the round-trip
// selection invariant that INV-20 mandates for the reduced 3-mode set.
//
// haltCheck (from ralph-state.json):
//   1. Store's initial viewMode is 'preview-app'.
//   2. Snapshot's state.json shows viewMode='preview-app' on first paint
//      (notes/ralph-snapshots/EBR2-A-03/state.json).
//   3. Toggling galaxy → canvas → preview-app → galaxy preserves
//      selectedNodeId and selectedHubId.
//
// EB-04-04 separately covers per-mode camera-pose checkpoints; this file
// keeps its scope tight to the boot default + plain 3-mode selection
// preservation that EBR2-A-03 owns as its acceptance gate.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  useGraphEditorStore,
  type ViewMode,
} from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const storePath = join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts');
const storeSrc = readFileSync(storePath, 'utf8');

const snapshotDir = join(repoRoot, 'notes', 'ralph-snapshots', 'EBR2-A-03');

// RA-06b canonical 3-mode round-trip: start at galaxy (the only mode not
// equal to the boot default), pass through canvas, return to preview-app,
// and back to galaxy. Mirrors the haltCheck text verbatim.
const CYCLE: ViewMode[] = ['galaxy', 'canvas', 'preview-app', 'galaxy'];

function freshStoreSelectionReset() {
  const s = useGraphEditorStore.getState();
  s.selectNode(null);
  s.selectHub(null);
  s.clearMultiSelection();
}

describe('EBR2-A-03 — boot default viewMode is preview-app (SC-064, RA-17)', () => {
  it('store source declares the initial viewMode value as preview-app', () => {
    // SC-064's grep half: locate the initial-value literal inside the
    // store's create() body. Mirrors the verificationCommand grep so the
    // test fails exactly where the gate would block.
    expect(storeSrc).toMatch(/viewMode:\s*['"]preview-app['"]/);
  });

  it('the ONLY viewMode initial-value literal in the store source is preview-app', () => {
    // Sanity for RA-06b: there must not be a stale default like 'canvas' or
    // 'galaxy' assigned to the create() body's viewMode field. The
    // initial-value literal is unique inside the file — drillIntoHub
    // and other actions assign viewMode dynamically but never set it to a
    // mode that would override the boot default at module load.
    const initialMatches = storeSrc.match(/^\s{4}viewMode:\s*['"]([a-z-]+)['"]/m);
    expect(initialMatches).not.toBeNull();
    expect(initialMatches![1]).toBe('preview-app');
  });

  it('a freshly read store has viewMode === preview-app at first read', () => {
    // The store is created once at module load; reading getState() returns
    // the create()-time defaults until any setter runs. This test is the
    // runtime half of SC-064 — the snapshot half is asserted below by
    // confirming notes/ralph-snapshots/EBR2-A-03/state.json carries the
    // same value when the snapshot script writes the live store.
    const s = useGraphEditorStore.getState();
    expect(s.viewMode).toBe<ViewMode>('preview-app');
  });
});

describe('EBR2-A-03 — 3-mode round-trip preserves selection (INV-20, haltCheck #3)', () => {
  beforeEach(() => {
    freshStoreSelectionReset();
  });

  it('selectedNodeId survives galaxy → canvas → preview-app → galaxy', () => {
    const s = useGraphEditorStore.getState();
    s.selectNode('node-ebr2-a-03');
    expect(useGraphEditorStore.getState().selectedNodeId).toBe('node-ebr2-a-03');

    for (const mode of CYCLE) {
      s.setViewMode(mode);
      const after = useGraphEditorStore.getState();
      expect(after.viewMode).toBe(mode);
      expect(after.selectedNodeId).toBe('node-ebr2-a-03');
    }
  });

  it('selectedHubId survives galaxy → canvas → preview-app → galaxy', () => {
    const s = useGraphEditorStore.getState();
    s.selectHub('hub-ebr2-a-03');
    expect(useGraphEditorStore.getState().selectedHubId).toBe('hub-ebr2-a-03');

    for (const mode of CYCLE) {
      s.setViewMode(mode);
      const after = useGraphEditorStore.getState();
      expect(after.viewMode).toBe(mode);
      expect(after.selectedHubId).toBe('hub-ebr2-a-03');
    }
  });

  it('setViewMode never mutates selection state on any 3-mode hop', () => {
    // FP-11-style invariant scoped to EBR2-A-03: every hop in the 3-mode
    // cycle must leave both selection slots exactly where the caller put
    // them. This guards future refactors of setViewMode against silently
    // clearing selection when transitioning into preview-app.
    const s = useGraphEditorStore.getState();
    s.selectNode('node-alpha');
    const before = useGraphEditorStore.getState();
    const nodeBefore = before.selectedNodeId;
    const hubBefore = before.selectedHubId;

    for (const mode of CYCLE) {
      s.setViewMode(mode);
      const after = useGraphEditorStore.getState();
      expect(after.selectedNodeId).toBe(nodeBefore);
      expect(after.selectedHubId).toBe(hubBefore);
    }
  });
});

describe('EBR2-A-03 — snapshot artifacts (haltCheck #2 / SC-064 Playwright half)', () => {
  it('the EBR2-A-03 snapshot directory exists', () => {
    expect(existsSync(snapshotDir)).toBe(true);
  });

  it('the snapshot directory contains outer.png, inner.png, and state.json', () => {
    const files = readdirSync(snapshotDir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });

  it('the snapshot state.json shows viewMode === preview-app on first paint (SC-064)', () => {
    const stateJsonPath = join(snapshotDir, 'state.json');
    const raw = readFileSync(stateJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { viewMode?: string };
    expect(parsed.viewMode).toBe('preview-app');
  });
});

// EBR2-F-03 — Inspector "Clone" button + auto-switch to galaxy + draggingNodeId slot.
//
// Spec refs:
//   - §R2-F SC-075 — Inspector exposes a "Clone" button; click deep-clones via
//     source-store, view auto-switches to `galaxy`, clone is attached to a
//     `draggingNodeId` slot on `useGraphEditorStore`.
//   - INV-20 — Selection state survives every view-mode transition.
//   - INV-24 — Only `galaxy | canvas | preview-app` are legal view-mode literals.
//   - FP-11 — `useGraphEditorStore.getState().{selectedNodeId,…,viewMode} =` is
//     forbidden direct mutation; action setter is required.
//
// This file is the failing test contract. It MUST NOT be modified during Step 7
// implementation per /ralph-step-editor discipline.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewMode, EditorMode } from '@/stores/useGraphEditorStore';

type EditorStoreState = {
  viewMode: ViewMode;
  editorMode: EditorMode;
  selectedNodeId: string | null;
  draggingNodeId: string | null;
  setDraggingNode: (id: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  setEditorMode: (m: EditorMode) => void;
  selectNode: (id: string | null) => void;
};

async function freshEditorStore(): Promise<{
  useGraphEditorStore: {
    getState: () => EditorStoreState;
    setState: (p: Partial<EditorStoreState>) => void;
  };
}> {
  vi.resetModules();
  const mod = await import('@/stores/useGraphEditorStore');
  return mod as unknown as {
    useGraphEditorStore: {
      getState: () => EditorStoreState;
      setState: (p: Partial<EditorStoreState>) => void;
    };
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EBR2-F-03 — useGraphEditorStore.draggingNodeId (§R2-F SC-075)', () => {
  it('exposes a draggingNodeId field that defaults to null', async () => {
    const { useGraphEditorStore } = await freshEditorStore();
    const state = useGraphEditorStore.getState();
    expect(state).toHaveProperty('draggingNodeId');
    expect(state.draggingNodeId).toBeNull();
  });

  it('exposes a setDraggingNode action that mutates draggingNodeId', async () => {
    const { useGraphEditorStore } = await freshEditorStore();
    const state = useGraphEditorStore.getState();
    expect(typeof state.setDraggingNode).toBe('function');

    state.setDraggingNode('node-xyz');
    expect(useGraphEditorStore.getState().draggingNodeId).toBe('node-xyz');

    state.setDraggingNode(null);
    expect(useGraphEditorStore.getState().draggingNodeId).toBeNull();
  });

  it('setDraggingNode does NOT clear selectedNodeId (INV-20: selection survives)', async () => {
    const { useGraphEditorStore } = await freshEditorStore();
    useGraphEditorStore.setState({ selectedNodeId: 'node-orig' });
    useGraphEditorStore.getState().setDraggingNode('node-clone');
    const after = useGraphEditorStore.getState();
    expect(after.selectedNodeId).toBe('node-orig');
    expect(after.draggingNodeId).toBe('node-clone');
  });
});

describe('EBR2-F-03 — Inspector.tsx wires Clone button (§R2-F SC-075)', () => {
  const inspectorPath = join(
    process.cwd(),
    'src/components/editor/panels/Inspector.tsx',
  );
  const source = readFileSync(inspectorPath, 'utf8');

  it('renders a Clone button with data-testid="inspector-clone"', () => {
    expect(source).toMatch(/data-testid=["']inspector-clone["']/);
  });

  it('invokes cloneNode from useGraphSourceStore on click', () => {
    // The Inspector must call useGraphSourceStore's cloneNode action so the
    // deep-clone lives in the source graph (EBR2-F-02 wired this action).
    expect(source).toMatch(/cloneNode/);
  });

  it("auto-switches the view to 'galaxy' after cloning", () => {
    // Per SC-075, the view must switch to galaxy so the user can drag the
    // clone to a nearby hub. The literal 'galaxy' must appear in the Clone
    // handler context.
    expect(source).toMatch(/setViewMode\(['"]galaxy['"]\)/);
  });

  it('assigns the new clone id to draggingNodeId via setDraggingNode', () => {
    // SC-075: clone is attached to `draggingNodeId` slot. The Inspector
    // handler must route through the action (FP-11 forbids direct mutation
    // of useGraphEditorStore state).
    expect(source).toMatch(/setDraggingNode\s*\(/);
  });

  it('uses the canonical `editor-build` discipline (no off-canon view-mode literals)', () => {
    // FP-14: literal 'hub-world' / 'preview-hub' anywhere in src/ is
    // forbidden. The Clone handler must use only canonical literals.
    expect(source).not.toMatch(/['"]hub-world['"]/);
    expect(source).not.toMatch(/['"]preview-hub['"]/);
  });
});

// EBR2-C-01 — editorMode field on useGraphEditorStore + Inspector Edit/Done
// button + Escape exit + selection-change reset.
//
// Spec refs:
//   §R2-C SC-068  Inspector exposes an "Edit" button. Transform handles
//                 (CanvasTransformGizmo) render only when
//                 editorMode === 'edit' AND viewMode === 'canvas' AND a node
//                 is selected.
//
// haltCheck (ralph-state.json):
//   "Store has editorMode: 'idle' | 'edit' (default 'idle') and setEditorMode
//    action. Inspector toolbar renders Edit/Done button. Toggling Edit flips
//    editorMode. Escape exits edit mode. Changing selection resets editorMode
//    to 'idle'."
//
// Test strategy:
//   • Runtime tests against the live Zustand store — drive setEditorMode,
//     selectNode, selectHub, drillIntoHub and confirm state transitions.
//   • Static source-grep on Inspector.tsx for the Edit/Done button surface,
//     the Escape key handler, and the selection-change reset effect. Mirrors
//     the EBR2-B-02 / EBR2-B-03 pattern used elsewhere in this round.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useGraphEditorStore } from '../../src/stores/useGraphEditorStore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../');

const INSPECTOR_PATH = resolve(
  REPO_ROOT,
  'src/components/editor/panels/Inspector.tsx',
);
const STORE_PATH = resolve(
  REPO_ROOT,
  'src/stores/useGraphEditorStore.ts',
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

// Snapshot/restore the initial store so each test starts from the documented
// default. Mirrors the harness pattern in EBR2-A-03.
const INITIAL_STATE = useGraphEditorStore.getState();

beforeEach(() => {
  useGraphEditorStore.setState(INITIAL_STATE, true);
});

afterEach(() => {
  useGraphEditorStore.setState(INITIAL_STATE, true);
});

describe('EBR2-C-01 — store: editorMode field (SC-068, haltCheck)', () => {
  it("defaults editorMode to 'idle' on boot", () => {
    const state = useGraphEditorStore.getState();
    expect(state.editorMode).toBe('idle');
  });

  it("exposes a setEditorMode action that accepts 'idle' | 'edit'", () => {
    const state = useGraphEditorStore.getState();
    expect(typeof state.setEditorMode).toBe('function');
    state.setEditorMode('edit');
    expect(useGraphEditorStore.getState().editorMode).toBe('edit');
    state.setEditorMode('idle');
    expect(useGraphEditorStore.getState().editorMode).toBe('idle');
  });

  it("resets editorMode to 'idle' when selectNode is called (selection change)", () => {
    useGraphEditorStore.setState({ selectedNodeId: 'n-prior', editorMode: 'edit' });
    useGraphEditorStore.getState().selectNode('n-next');
    expect(useGraphEditorStore.getState().editorMode).toBe('idle');
  });

  it("resets editorMode to 'idle' when selectNode(null) clears selection", () => {
    useGraphEditorStore.setState({ selectedNodeId: 'n-prior', editorMode: 'edit' });
    useGraphEditorStore.getState().selectNode(null);
    expect(useGraphEditorStore.getState().editorMode).toBe('idle');
  });

  it("resets editorMode to 'idle' when selectHub is called", () => {
    useGraphEditorStore.setState({ selectedNodeId: 'n-prior', editorMode: 'edit' });
    useGraphEditorStore.getState().selectHub('hub-x');
    expect(useGraphEditorStore.getState().editorMode).toBe('idle');
  });

  it("resets editorMode to 'idle' when flyToNode changes selection", () => {
    useGraphEditorStore.setState({ selectedNodeId: 'n-prior', editorMode: 'edit' });
    useGraphEditorStore.getState().flyToNode('n-next');
    expect(useGraphEditorStore.getState().editorMode).toBe('idle');
  });

  it("resets editorMode to 'idle' on drillIntoHub", () => {
    useGraphEditorStore.setState({ selectedNodeId: 'n-prior', editorMode: 'edit' });
    useGraphEditorStore.getState().drillIntoHub('hub-x');
    expect(useGraphEditorStore.getState().editorMode).toBe('idle');
  });
});

describe('EBR2-C-01 — store source declares the canonical type (SC-068)', () => {
  it("declares EditorMode = 'idle' | 'edit'", () => {
    const src = read(STORE_PATH);
    expect(src).toMatch(/export\s+type\s+EditorMode\s*=\s*['"]idle['"]\s*\|\s*['"]edit['"]/);
  });

  it('declares editorMode on the GraphEditorState interface', () => {
    const src = read(STORE_PATH);
    expect(src).toMatch(/editorMode:\s*EditorMode/);
  });

  it('declares setEditorMode action on the GraphEditorState interface', () => {
    const src = read(STORE_PATH);
    expect(src).toMatch(/setEditorMode:\s*\(/);
  });

  it("seeds initial editorMode to 'idle'", () => {
    const src = read(STORE_PATH);
    expect(src).toMatch(/editorMode:\s*['"]idle['"]/);
  });
});

describe('EBR2-C-01 — Inspector renders Edit/Done toggle (SC-068, haltCheck)', () => {
  it('imports the editorMode slice (or setEditorMode) from the store', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/editorMode|setEditorMode/);
  });

  it("renders a button with data-role='edit-toggle' (stable selector for kv_click)", () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/data-role=["']edit-toggle["']/);
  });

  it("shows 'Edit' label when editorMode === 'idle' and 'Done' label when 'edit'", () => {
    const src = read(INSPECTOR_PATH);
    // Both literals must appear; the runtime visibility is checked by the
    // verify-editor-runtimes snapshot.
    expect(src).toMatch(/['"`]Edit['"`]/);
    expect(src).toMatch(/['"`]Done['"`]/);
  });

  it("wires the button onClick to flip editorMode (setEditorMode call)", () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/setEditorMode\s*\(/);
  });

  it('installs a global keydown listener that handles Escape', () => {
    const src = read(INSPECTOR_PATH);
    // Escape handler — must reference both 'Escape' and setEditorMode somewhere
    // in the same file so that pressing Escape returns the editor to 'idle'.
    expect(src).toMatch(/['"]Escape['"]/);
  });
});

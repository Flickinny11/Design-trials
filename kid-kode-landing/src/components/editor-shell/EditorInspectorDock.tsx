'use client';

// PRISM EDITOR INTEGRATION — I-3: the INSPECTOR, docked.
//
// Mounts the real in-canvas Inspector (full-schema editing, live) into the right
// INSPECTOR dock zone whose glass frame + label are drawn by EditorDocks. The
// controls sit just in front of that pane and edit the SELECTED node's schema on
// the live app graph. Editor CHROME (not a graph node) — not tagged
// prismEditorNode, so the node-authorship gate ignores it.

import { EditorInspector } from './editor-inspector';

// Matches the INSPECTOR dock placement in EditorDock.tsx.
export const INSPECTOR_DOCK_POS: [number, number, number] = [11.7, -0.1, 1.0];

export function EditorInspectorDock() {
  return <EditorInspector position={INSPECTOR_DOCK_POS} />;
}

'use client';

// PRISM WORKSPACE COMPLETION — W-1: the right glass dock, now a TABBED surface.
//
// Two distinct surfaces share the right INSPECTOR dock, switched by a worn-cube
// tab pair at the top of the pane:
//   • NODE   — the in-engine NODE EDITOR (the per-node PURPOSE surface: caption /
//              behavior / schema). Purpose-only: it shows the node in its
//              in-built state (data / meaning), NEVER a visual-editor mode (C2 /
//              anchor F7). This is the W-1 deliverable.
//   • VISUAL — the existing canvas property inspector (geometry / material /
//              scale faders + tint + slot). Unchanged; visual editing stays in
//              canvas (EDIT-I3/I4).
// Both edit the SELECTED node on the live app graph; both are editor CHROME (not
// tagged prismEditorNode). NodeEditorKeyboard (the single window-keydown capture
// for the glass text fields) mounts here once.

import { useEffect } from 'react';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { EditorInspector } from './editor-inspector';
import { EditorNodeEditor, installNodeEditorProbe } from './editor-node-editor';
import { EditorNodeTabs } from './editor-node-tabs';
import { NodeEditorKeyboard } from './editor-text-field';
import { useEditorShellStore } from './use-editor-shell-store';
import { installCapabilityProbe } from './use-capability-store';

// Matches the INSPECTOR dock placement in EditorDock.tsx.
export const INSPECTOR_DOCK_POS: [number, number, number] = [11.7, -0.1, 1.0];
// drop the active surface below the tab switch so the tabs have clear air.
const CONTENT_DROP = 0.55;

export function EditorInspectorDock() {
  const tab = useEditorShellStore((s) => s.inspectorTab);
  const maps = useWornMaps();
  const gun = maps['gunmetal'];
  const [bx, by, bz] = INSPECTOR_DOCK_POS;
  const contentPos: [number, number, number] = [bx, by - CONTENT_DROP, bz];
  // the NODE editor gains a section sub-tab row, so its content drops further to
  // clear it (the VISUAL inspector has no sub-tabs and keeps the higher anchor).
  const nodeContentPos: [number, number, number] = [bx, by - CONTENT_DROP - 0.42, bz];

  // install the headless probes once (survive tab switches — both docks always mount).
  useEffect(() => installNodeEditorProbe(), []);
  useEffect(() => installCapabilityProbe(), []);

  return (
    <>
      {/* the single keyboard capture for the in-engine glass text fields */}
      <NodeEditorKeyboard />

      {/* NODE / VISUAL tab switch (worn cubes) at the top of the dock */}
      {gun && (
        <group position={[bx, by + 3.92, bz + 0.2]}>
          <CompositeChip
            maps={gun}
            position={[-0.62, 0, 0]}
            size={0.34}
            label="NODE"
            active={tab === 'node'}
            tint={tab === 'node' ? '#9fd0ff' : undefined}
            onClick={() => useEditorShellStore.getState().setInspectorTab('node')}
          />
          <CompositeChip
            maps={gun}
            position={[0.62, 0, 0]}
            size={0.34}
            label="VISUAL"
            active={tab === 'visual'}
            tint={tab === 'visual' ? '#caa06a' : undefined}
            onClick={() => useEditorShellStore.getState().setInspectorTab('visual')}
          />
        </group>
      )}

      {/* NODE section sub-tabs (PURPOSE / FUNCTIONS / INTEGRATIONS / DATA) —
          only on the NODE tab; sits just under the NODE/VISUAL switch. */}
      {tab === 'node' && <EditorNodeTabs position={[bx, by + 3.42, bz + 0.2]} />}

      {tab === 'node' ? (
        <EditorNodeEditor position={nodeContentPos} />
      ) : (
        <EditorInspector position={contentPos} />
      )}
    </>
  );
}

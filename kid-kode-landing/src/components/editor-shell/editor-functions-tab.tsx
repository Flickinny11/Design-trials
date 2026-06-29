'use client';

// PRISM WORKSPACE COMPLETION — W-2 FUNCTIONS section (criteria D1/D2/D4/D5).
// Wave w-tabs: scaffold (section header + live attached-tile summary). The
// capability-first SEARCH, branded TILES, drag-to-attach, validate + snippets
// land in w-catalog. ZERO DOM. Editor CHROME.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useEditorShellStore } from './use-editor-shell-store';

export function EditorFunctionsTab({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  // select a stable PRIMITIVE (count) — never a fresh array (`?? []` in a zustand
  // selector returns a new reference each render → infinite getSnapshot loop).
  const count = useGraphSourceStore((s) =>
    (selectedId ? s.nodes.find((n) => n.nodeId === selectedId)?.functionTiles?.length : 0) ?? 0,
  );
  return (
    <group position={position}>
      <CompositeText position={[-1.32, 3.0, 0.32]} fontSize={0.135} anchorX="left" variant="bright">
        FUNCTIONS
      </CompositeText>
      <CompositeText position={[-1.32, 2.6, 0.32]} fontSize={0.1} anchorX="left" variant="engraved">
        {count > 0 ? `${count} attached` : 'SEARCH A CAPABILITY TO ATTACH'}
      </CompositeText>
    </group>
  );
}

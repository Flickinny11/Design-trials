'use client';

// PRISM WORKSPACE COMPLETION — W-2 DATA section (criteria C3).
// Wave w-tabs: scaffold (section header + live data-model summary). The state
// fields editor + persistence binding (db/storage from the catalog,
// reference-only) + validate land in w-data. ZERO DOM. Editor CHROME.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useEditorShellStore } from './use-editor-shell-store';

export function EditorDataTab({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const dataModel = useGraphSourceStore((s) =>
    selectedId ? s.nodes.find((n) => n.nodeId === selectedId)?.dataModel ?? null : null,
  );
  const fieldCount = dataModel?.fields?.length ?? 0;
  const bound = dataModel?.persistence?.platform;
  return (
    <group position={position}>
      <CompositeText position={[-1.32, 3.0, 0.32]} fontSize={0.135} anchorX="left" variant="bright">
        DATA
      </CompositeText>
      <CompositeText position={[-1.32, 2.6, 0.32]} fontSize={0.1} anchorX="left" variant="engraved">
        {fieldCount > 0 || bound
          ? `${fieldCount} fields${bound ? ` · ${bound}` : ''}`
          : 'DEFINE STATE + PERSISTENCE'}
      </CompositeText>
    </group>
  );
}

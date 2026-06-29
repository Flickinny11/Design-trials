'use client';

// PRISM WORKSPACE COMPLETION — W-2 INTEGRATIONS section (criteria D3).
// Wave w-tabs: scaffold (section header + live connected-ref summary). The
// platform search, ONE-CLICK auth (reference-only), and self-populating saved
// assets land in w-auth. ZERO DOM. Editor CHROME.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useEditorShellStore } from './use-editor-shell-store';

export function EditorIntegrationsTab({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const count = useGraphSourceStore((s) =>
    (selectedId ? s.nodes.find((n) => n.nodeId === selectedId)?.integrationRefs?.length : 0) ?? 0,
  );
  return (
    <group position={position}>
      <CompositeText position={[-1.32, 3.0, 0.32]} fontSize={0.135} anchorX="left" variant="bright">
        INTEGRATIONS
      </CompositeText>
      <CompositeText position={[-1.32, 2.6, 0.32]} fontSize={0.1} anchorX="left" variant="engraved">
        {count > 0 ? `${count} connected` : 'CONNECT A PLATFORM (REFERENCE-ONLY)'}
      </CompositeText>
    </group>
  );
}

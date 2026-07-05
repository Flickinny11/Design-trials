'use client';

// RightPane — chooses between node Inspector and HubInspector based on
// the current selection in useGraphEditorStore. Both panels self-render
// nothing when their selection is null, so even when neither selection
// is active this component simply mounts both and lets each gate itself.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 3.

import Inspector from './Inspector';
import HubInspector from './HubInspector';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

export default function RightPane() {
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const selectedHubId = useGraphEditorStore((s) => s.selectedHubId);

  if (selectedHubId && !selectedNodeId) return <HubInspector />;
  return <Inspector />;
}

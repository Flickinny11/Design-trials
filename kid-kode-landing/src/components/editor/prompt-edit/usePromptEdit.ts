'use client';

// PRISM NODE-EDITOR V2 — shared prompt-edit hook (criteria A).
// One source of truth for the canvas "Prompt Edit" flyout AND the node editor's
// own scoped prompt-edit (A5). Calls the orchestration endpoint, holds the plan,
// applies it via applyPlan, and persists. Multi-select aware (A1).

import { useCallback, useMemo, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { applyPlan, type ApplyPlanReport } from '@/lib/prompt-edit/apply-plan';
import type { PromptEditPlan, PromptEditScope } from '@/lib/prompt-edit/contract';
import type { PrismNode } from '@/lib/prism-graph/types';

export interface UsePromptEdit {
  prompt: string;
  setPrompt: (s: string) => void;
  plan: PromptEditPlan | null;
  report: ApplyPlanReport | null;
  busy: boolean;
  error: string | null;
  effectiveIds: string[];
  selLabel: string;
  generate: () => Promise<void>;
  apply: () => Promise<void>;
  reset: () => void;
}

export function usePromptEdit(scope: PromptEditScope, onToast?: (m: string) => void): UsePromptEdit {
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  const selectedNodeIds = useGraphEditorStore((s) => s.selectedNodeIds);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const nodes = useGraphSourceStore((s) => s.nodes);
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  const saveToServer = useGraphSourceStore((s) => s.saveToServer);

  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PromptEditPlan | null>(null);
  const [report, setReport] = useState<ApplyPlanReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveIds = useMemo<string[]>(() => {
    if (selectedNodeIds && selectedNodeIds.size >= 2) return [...selectedNodeIds];
    if (selectedNodeId) return [selectedNodeId];
    return [];
  }, [selectedNodeId, selectedNodeIds]);

  const nodeById = useCallback(
    (id: string): PrismNode | undefined => nodes.find((n) => n.nodeId === id),
    [nodes],
  );

  const generate = useCallback(async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const snapshots = effectiveIds.map((id) => {
        const n = nodeById(id);
        return { nodeId: id, subtype: n?.subtype, renderMode: n?.renderMode };
      });
      // W-2D — the planner styles for the hub's composition mode: on a 2d
      // hub it keeps placement flat (z=0, no tilt); 3D accents remain legal.
      const activeHub = activeHubId
        ? useGraphSourceStore.getState().hubs.find((h) => h.hubId === activeHubId)
        : undefined;
      const hubRenderMode = activeHub?.renderMode === '2d' ? '2d' : '3d';
      const res = await fetch('/api/prism/prompt-edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: p, scope, selection: { nodeIds: effectiveIds, hubId: activeHubId ?? undefined, hubRenderMode }, nodes: snapshots }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'orchestration failed');
      setPlan(data.plan as PromptEditPlan);
    } catch (e) {
      setError((e as Error).message);
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }, [prompt, busy, effectiveIds, nodeById, activeHubId, scope]);

  const apply = useCallback(async () => {
    if (!plan || busy) return;
    setBusy(true);
    try {
      const io = {
        getNode: (id: string) => nodeById(id),
        updateNode: (id: string, patch: Partial<PrismNode>) => updateNode(id, patch),
        now: new Date().toISOString(),
      };
      const rep = applyPlan(plan, io);
      setReport(rep);
      try { await saveToServer?.(); } catch { /* autosave retries */ }
      const changed = rep.applied;
      onToast?.(changed > 0 ? `Applied ${changed} change${changed === 1 ? '' : 's'} to ${rep.touchedNodeIds.length} element${rep.touchedNodeIds.length === 1 ? '' : 's'}` : 'Plan recorded (suggestions only)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [plan, busy, nodeById, updateNode, saveToServer, onToast]);

  const reset = useCallback(() => { setPlan(null); setReport(null); setError(null); setPrompt(''); }, []);

  const selLabel = effectiveIds.length === 0 ? 'no selection (acts on a new element)' : effectiveIds.length === 1 ? '1 element selected' : `${effectiveIds.length} elements selected`;

  return { prompt, setPrompt, plan, report, busy, error, effectiveIds, selLabel, generate, apply, reset };
}

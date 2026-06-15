'use client';

// PRISM NODE-EDITOR V2 — Functions tab (criteria B). Lives OUTSIDE panels/ so the
// purpose-edit write (functionTiles via updateNode) follows the FunctionBindingPopup
// precedent and is not bound by FP-15 (which governs VISUAL fader/knob tabs).
//
// B1 autocomplete search → B2 branded REAL-logo tiles (drag or click to attach) →
// B3 multiple per node, reorderable, attach/detach round-trips → B4 validate-on-
// select (live sandbox test via the adapter; broken → auto-fix in place) → B5
// paste/save/NAME custom snippets (SnippetStore, per-user) reusable across builds.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import BrandLogo from './BrandLogo';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode, FunctionTile, FunctionTileValidationStatus } from '@/lib/prism-graph/types';
import type { ActionTileDescriptor } from '@/lib/capabilities/provider';

const USER_ID = 'local-user';

interface SnippetRow { id: string; name: string; brandKey: string; platform: string; label: string; actionId: string; providerId: string; }

function statusColor(s?: FunctionTileValidationStatus): string {
  switch (s) {
    case 'valid': return '#5fce8e';
    case 'fixed': return '#9ed27a';
    case 'broken': return '#e0795f';
    case 'validating': return '#d9b878';
    default: return 'var(--ds-text-low)';
  }
}
function statusLabel(s?: FunctionTileValidationStatus): string {
  return s === 'valid' ? 'Valid' : s === 'fixed' ? 'Auto-fixed' : s === 'broken' ? 'Broken' : s === 'validating' ? 'Testing…' : 'Untested';
}

export default function FunctionsTab({ node, onToast }: { node: PrismNode; onToast?: (m: string) => void }) {
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  const saveToServer = useGraphSourceStore((s) => s.saveToServer);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ActionTileDescriptor[]>([]);
  const [providerLive, setProviderLive] = useState(false);
  const [snippets, setSnippets] = useState<SnippetRow[]>([]);
  const [snipName, setSnipName] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tiles = (node.functionTiles ?? []).slice().sort((a, b) => a.order - b.order);

  const persist = useCallback(async (next: FunctionTile[]) => {
    updateNode(node.nodeId, { functionTiles: next });
    try { await saveToServer?.(); } catch { /* autosave retries */ }
  }, [node.nodeId, updateNode, saveToServer]);

  // B1 — autocomplete search (debounced).
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const q = query.trim();
      try {
        const res = await fetch('/api/prism/capabilities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'searchActions', query: q }) });
        const data = await res.json();
        if (data.ok) { setResults(data.tiles ?? []); setProviderLive(!!data.live); }
      } catch { /* ignore */ }
    }, 160);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  // B5 — load user snippets.
  const loadSnippets = useCallback(async () => {
    try {
      const res = await fetch(`/api/prism/snippets?userId=${USER_ID}`);
      const data = await res.json();
      if (data.ok) setSnippets(data.snippets ?? []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadSnippets(); }, [loadSnippets]);

  // B4 — validate a tile against the provider; broken → apply auto-fix in place.
  const validateTile = useCallback(async (tileId: string) => {
    const current = (useGraphSourceStore.getState().nodes.find((n) => n.nodeId === node.nodeId)?.functionTiles) ?? [];
    const tile = current.find((t) => t.id === tileId);
    if (!tile) return;
    const setStatus = (patch: Partial<FunctionTile>) => {
      const next = (useGraphSourceStore.getState().nodes.find((n) => n.nodeId === node.nodeId)?.functionTiles ?? []).map((t) => (t.id === tileId ? { ...t, ...patch } : t));
      updateNode(node.nodeId, { functionTiles: next });
    };
    setStatus({ validation: { status: 'validating' } });
    try {
      const res = await fetch('/api/prism/capabilities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'validateAction', actionId: tile.actionId, params: tile.params }) });
      const data = await res.json();
      const r = data.result;
      if (r?.ok) {
        setStatus({ validation: { status: 'valid', testedAt: new Date().toISOString(), message: r.message } });
      } else if (r?.autoFix) {
        // Opus auto-fix in place: apply the proposed params, re-validate → fixed.
        setStatus({ params: r.autoFix.params, validation: { status: 'fixed', testedAt: new Date().toISOString(), message: r.message, autoFixNote: r.autoFix.note } });
        onToast?.(`Auto-fixed ${tile.platform} · ${tile.label}`);
      } else {
        setStatus({ validation: { status: 'broken', testedAt: new Date().toISOString(), message: r?.message ?? 'validation failed' } });
      }
    } catch (e) {
      setStatus({ validation: { status: 'broken', message: (e as Error).message } });
    } finally {
      try { await saveToServer?.(); } catch { /* ignore */ }
    }
  }, [node.nodeId, updateNode, saveToServer, onToast]);

  // B2/B3 — attach a tile (from a search result or a snippet) + validate-on-select.
  const attach = useCallback(async (d: { actionId: string; brandKey: string; label: string; platform: string; providerId?: string; params?: Record<string, unknown>; source?: 'catalog' | 'snippet'; snippetId?: string }) => {
    const existing = (useGraphSourceStore.getState().nodes.find((n) => n.nodeId === node.nodeId)?.functionTiles) ?? [];
    const order = existing.length ? Math.max(...existing.map((t) => t.order)) + 1 : 0;
    const id = `ft-${Math.abs(hash(node.nodeId + d.actionId + order)).toString(36)}`;
    const tile: FunctionTile = { id, order, providerId: d.providerId ?? 'mcp', actionId: d.actionId, brandKey: d.brandKey, label: d.label, platform: d.platform, source: d.source ?? 'catalog', snippetId: d.snippetId, params: d.params, validation: { status: 'unvalidated' } };
    await persist([...existing, tile]);
    onToast?.(`Attached ${d.platform} · ${d.label}`);
    void validateTile(id); // validate-on-select (B4)
  }, [node.nodeId, persist, onToast, validateTile]);

  const detach = useCallback(async (id: string) => {
    await persist(tiles.filter((t) => t.id !== id).map((t, i) => ({ ...t, order: i })));
  }, [tiles, persist]);

  const reorder = useCallback(async (id: string, dir: -1 | 1) => {
    const arr = tiles.slice();
    const i = arr.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await persist(arr.map((t, k) => ({ ...t, order: k })));
  }, [tiles, persist]);

  // B5 — save a custom snippet (from the first attached tile, or a blank custom).
  const saveSnippet = useCallback(async () => {
    const name = snipName.trim();
    if (!name) return;
    const seed = tiles[0];
    const body = {
      userId: USER_ID, name,
      providerId: seed?.providerId ?? 'custom', actionId: seed?.actionId ?? 'custom-action',
      brandKey: seed?.brandKey ?? 'custom', platform: seed?.platform ?? 'Custom', label: seed?.label ?? name,
      params: seed?.params,
    };
    try {
      const res = await fetch('/api/prism/snippets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.ok) { setSnipName(''); onToast?.(`Saved snippet "${name}"`); loadSnippets(); }
    } catch { /* ignore */ }
  }, [snipName, tiles, onToast, loadSnippets]);

  return (
    <div data-component="functions-tab" className="px-3 py-2 flex flex-col gap-2.5" style={{ color: 'var(--ds-text)' }}>
      {/* Search */}
      <div className="flex items-center gap-1.5 ds-well rounded-[5px] px-2 py-1" style={{ background: 'var(--ds-grad-well)', boxShadow: 'var(--ds-chamfer-soft, inset 0 1px 2px rgba(0,0,0,0.45))' }}>
        <Icon name="search" size={11} color="var(--ds-text-low)" />
        <input
          data-role="fn-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search actions — stripe, slack, runpod…"
          className="flex-1 bg-transparent outline-none text-[10px] font-mono"
          style={{ color: 'var(--ds-text-hi)' }}
        />
        <span className="text-[7px] font-mono uppercase tracking-[0.12em]" style={{ color: 'var(--ds-text-low)' }}>{providerLive ? 'live' : 'mcp'}</span>
      </div>

      {/* Results (B2) */}
      {results.length > 0 && (
        <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto" data-role="fn-results">
          {results.slice(0, 12).map((r) => (
            <button
              key={r.actionId}
              type="button"
              data-role="fn-result"
              data-action-id={r.actionId}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/x-fn-action', JSON.stringify(r))}
              onClick={() => attach({ actionId: r.actionId, brandKey: r.brandKey, label: r.label, platform: r.platform })}
              className="flex items-center gap-2 px-1.5 py-1 rounded-[5px] text-left transition-colors hover:bg-white/[0.05]"
              style={{ background: 'rgba(255,255,255,0.025)' }}
            >
              <BrandLogo brandKey={r.brandKey} size={18} />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] font-mono truncate" style={{ color: 'var(--ds-text-hi)' }}>{r.label}</span>
                <span className="text-[8px] font-mono truncate" style={{ color: 'var(--ds-text-low)' }}>{r.platform}{r.category ? ` · ${r.category}` : ''}</span>
              </div>
              <Icon name="plus" size={10} color="var(--ds-brass-300)" />
            </button>
          ))}
        </div>
      )}

      {/* Attached (B3) — drop zone + reorderable list */}
      <div
        data-role="fn-attached-zone"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData('application/x-fn-action');
          if (raw) { try { const r = JSON.parse(raw); attach({ actionId: r.actionId, brandKey: r.brandKey, label: r.label, platform: r.platform }); } catch { /* ignore */ } }
        }}
        className="flex flex-col gap-1 rounded-[6px] p-1.5"
        style={{ border: '1px dashed var(--ds-edge-shade, rgba(0,0,0,0.4))' }}
      >
        <span className="text-[7.5px] font-mono uppercase tracking-[0.14em] px-0.5" style={{ color: 'var(--ds-brass-300)' }}>Attached functions ({tiles.length})</span>
        {tiles.length === 0 && <span className="text-[8.5px] font-mono px-1 py-1.5 text-center" style={{ color: 'var(--ds-text-low)' }}>Click or drag an action to attach</span>}
        {tiles.map((t, i) => (
          <div key={t.id} data-role="fn-attached" data-tile-id={t.id} data-validation={t.validation?.status ?? 'unvalidated'} className="flex items-center gap-1.5 px-1.5 py-1 rounded-[5px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="text-[8px] font-mono tabular-nums w-3" style={{ color: 'var(--ds-text-low)' }}>{i + 1}</span>
            <BrandLogo brandKey={t.brandKey} size={16} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[9.5px] font-mono truncate" style={{ color: 'var(--ds-text-hi)' }}>{t.label}</span>
              <span className="text-[7.5px] font-mono" style={{ color: statusColor(t.validation?.status) }} data-role="fn-status">{t.platform} · {statusLabel(t.validation?.status)}</span>
            </div>
            <button type="button" data-role="fn-validate" title="Re-validate" onClick={() => validateTile(t.id)} className="p-0.5 rounded hover:bg-white/10"><Icon name="refresh" size={9} color="var(--ds-text-low)" /></button>
            <button type="button" data-role="fn-reorder-up" title="Move up" disabled={i === 0} onClick={() => reorder(t.id, -1)} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"><Icon name="chevron" size={9} color="var(--ds-text-low)" /></button>
            <button type="button" data-role="fn-reorder-down" title="Move down" disabled={i === tiles.length - 1} onClick={() => reorder(t.id, 1)} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"><span style={{ display: 'inline-block', transform: 'rotate(180deg)' }}><Icon name="chevron" size={9} color="var(--ds-text-low)" /></span></button>
            <button type="button" data-role="fn-detach" title="Detach" onClick={() => detach(t.id)} className="p-0.5 rounded hover:bg-white/10"><Icon name="close" size={9} color="var(--ds-text-low)" /></button>
          </div>
        ))}
      </div>

      {/* Custom snippets (B5) */}
      <div className="flex flex-col gap-1.5 rounded-[6px] p-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.4))' }}>
        <span className="text-[7.5px] font-mono uppercase tracking-[0.14em]" style={{ color: 'var(--ds-brass-300)' }}>My snippets</span>
        <div className="flex items-center gap-1.5">
          <input data-role="fn-snippet-name" value={snipName} onChange={(e) => setSnipName(e.target.value)} placeholder="Name a reusable snippet…" className="flex-1 ds-well rounded-[4px] px-1.5 py-1 bg-transparent outline-none text-[9px] font-mono" style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-well)' }} />
          <button type="button" data-role="fn-snippet-save" disabled={!snipName.trim()} onClick={saveSnippet} className="flex items-center gap-1 rounded-[4px] px-1.5 py-1 text-[8.5px] font-mono disabled:opacity-40" style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-brass, linear-gradient(180deg,#b9914f,#8c6a32))' }}><Icon name="save" size={9} color="var(--ds-text-hi)" />Save</button>
        </div>
        {snippets.map((s) => (
          <button key={s.id} type="button" data-role="fn-snippet" data-snippet-id={s.id} onClick={() => attach({ actionId: s.actionId, brandKey: s.brandKey, label: s.label, platform: s.platform, providerId: s.providerId, source: 'snippet', snippetId: s.id })} className="flex items-center gap-2 px-1.5 py-1 rounded-[5px] text-left hover:bg-white/[0.05]" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <BrandLogo brandKey={s.brandKey} size={15} />
            <span className="text-[9px] font-mono flex-1 truncate" style={{ color: 'var(--ds-text-hi)' }}>{s.name}</span>
            <span className="text-[7px] font-mono uppercase" style={{ color: 'var(--ds-text-low)' }}>snippet</span>
            <Icon name="plus" size={9} color="var(--ds-brass-300)" />
          </button>
        ))}
      </div>
    </div>
  );
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

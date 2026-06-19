'use client';

// PRISM NODE-EDITOR V2 — Integrations tab (criteria C). Outside panels/ so the
// purpose-edit write (integrationRefs via updateNode) follows the
// FunctionBindingPopup precedent (not bound by FP-15).
//
// C1 auto-fill platform search + branded logos → C2 ONE-CLICK AUTH (OAuth 2.1 /
// MCP / API token / CLI) via the adapter's managed auth, storing a CAPABILITY
// REFERENCE only (INV-R13 — never a raw token) → C3 self-populate the user's
// saved assets → drag/click into the node → C5 each integration carries a
// content-icon descriptor surfaced on the galaxy node (§3.3).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import BrandLogo from '@/components/editor/functions/BrandLogo';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode, IntegrationRef, IntegrationAsset, IntegrationAuthMethod, CapabilityRef } from '@/lib/prism-graph/types';
import type { PlatformDescriptor } from '@/lib/capabilities/provider';

const METHOD_LABEL: Record<IntegrationAuthMethod, string> = {
  'oauth2.1': 'OAuth 2.1',
  mcp: 'MCP',
  'api-token': 'API token',
  cli: 'CLI',
};

export default function IntegrationsTab({ node, onToast }: { node: PrismNode; onToast?: (m: string) => void }) {
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  const saveToServer = useGraphSourceStore((s) => s.saveToServer);

  const [query, setQuery] = useState('');
  const [platforms, setPlatforms] = useState<PlatformDescriptor[]>([]);
  const [providerLive, setProviderLive] = useState(false);
  const [assetsByPlatform, setAssetsByPlatform] = useState<Record<string, IntegrationAsset[]>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refs = (node.integrationRefs ?? []).slice().sort((a, b) => a.order - b.order);

  const persist = useCallback(async (next: IntegrationRef[]) => {
    updateNode(node.nodeId, { integrationRefs: next });
    try { await saveToServer?.(); } catch { /* autosave retries */ }
  }, [node.nodeId, updateNode, saveToServer]);

  const liveRefs = () => (useGraphSourceStore.getState().nodes.find((n) => n.nodeId === node.nodeId)?.integrationRefs) ?? [];

  // C1 — autocomplete platform search.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/prism/capabilities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'searchPlatforms', query: query.trim() }) });
        const data = await res.json();
        if (data.ok) { setPlatforms(data.platforms ?? []); setProviderLive(!!data.live); }
      } catch { /* ignore */ }
    }, 160);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  // C2 — one-click auth → capability REFERENCE only.
  const connect = useCallback(async (p: PlatformDescriptor, method: IntegrationAuthMethod) => {
    setConnecting(p.platformId);
    try {
      const res = await fetch('/api/prism/capabilities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'connect', platformId: p.platformId, method }) });
      const data = await res.json();
      const r = data.result;
      if (!r?.ok || !r.capabilityRef) { onToast?.(r?.message ?? 'connect failed'); return; }
      const capabilityRef = r.capabilityRef as CapabilityRef;
      const existing = liveRefs();
      const order = existing.length ? Math.max(...existing.map((x) => x.order)) + 1 : 0;
      const ref: IntegrationRef = {
        id: `ig-${Math.abs(hash(node.nodeId + p.platformId + order)).toString(36)}`,
        order, providerId: 'mcp', platformId: p.platformId, platform: p.platform, authMethod: method,
        capabilityRef, assets: [], contentIcon: { brandKey: p.brandKey },
      };
      await persist([...existing, ref]);
      onToast?.(`Connected ${p.platform} (${METHOD_LABEL[method]}) — capability reference stored`);
      // C3 — self-populate saved assets.
      const ar = await fetch('/api/prism/capabilities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'listAssets', platformId: p.platformId, capabilityRef }) });
      const ad = await ar.json();
      if (ad.ok) setAssetsByPlatform((m) => ({ ...m, [p.platformId]: ad.assets ?? [] }));
    } catch (e) { onToast?.((e as Error).message); }
    finally { setConnecting(null); }
  }, [node.nodeId, persist, onToast]);

  const addAsset = useCallback(async (refId: string, asset: IntegrationAsset) => {
    const next = liveRefs().map((r) => r.id === refId ? { ...r, assets: dedupe([...(r.assets ?? []), asset]) } : r);
    await persist(next);
    onToast?.(`Added ${asset.name}`);
  }, [persist, onToast]);

  const removeAsset = useCallback(async (refId: string, assetId: string) => {
    const next = liveRefs().map((r) => r.id === refId ? { ...r, assets: (r.assets ?? []).filter((a) => a.id !== assetId) } : r);
    await persist(next);
  }, [persist]);

  const detach = useCallback(async (id: string) => {
    await persist(refs.filter((r) => r.id !== id).map((r, i) => ({ ...r, order: i })));
  }, [refs, persist]);

  return (
    <div data-component="integrations-tab" className="px-3 py-2 flex flex-col gap-2.5" style={{ color: 'var(--ds-text)' }}>
      {/* Search */}
      <div className="flex items-center gap-1.5 ds-well rounded-[5px] px-2 py-1" style={{ background: 'var(--ds-grad-well)', boxShadow: 'var(--ds-chamfer-soft, inset 0 1px 2px rgba(0,0,0,0.45))' }}>
        <Icon name="search" size={11} color="var(--ds-text-low)" />
        <input data-role="int-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search platforms — runpod, supabase, github…" className="flex-1 bg-transparent outline-none text-[10px] font-mono" style={{ color: 'var(--ds-text-hi)' }} />
        <span className="text-[7px] font-mono uppercase tracking-[0.12em]" style={{ color: 'var(--ds-text-low)' }}>{providerLive ? 'live' : 'mcp'}</span>
      </div>

      {/* Platform results (C1) */}
      {platforms.length > 0 && (
        <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto" data-role="int-results">
          {platforms.slice(0, 10).map((p) => {
            const connected = refs.some((r) => r.platformId === p.platformId);
            return (
              <div key={p.platformId} data-role="int-platform" data-platform-id={p.platformId} className="flex flex-col gap-1 px-1.5 py-1 rounded-[5px]" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-center gap-2">
                  <BrandLogo brandKey={p.brandKey} size={18} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[10px] font-mono truncate" style={{ color: 'var(--ds-text-hi)' }}>{p.platform}</span>
                    <span className="text-[8px] font-mono truncate" style={{ color: 'var(--ds-text-low)' }}>{p.description}</span>
                  </div>
                  {connected && <Icon name="check" size={11} color="#5fce8e" />}
                </div>
                {/* C2 — one-click auth methods */}
                <div className="flex flex-wrap gap-1 pl-6">
                  {p.authMethods.map((m) => (
                    <button key={m} type="button" data-role="int-connect" data-method={m} disabled={connecting === p.platformId} onClick={() => connect(p, m)} className="text-[8px] font-mono px-1.5 py-0.5 rounded disabled:opacity-40" style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-metal, linear-gradient(180deg,#dfe2e6,#898c92))' }}>
                      {connecting === p.platformId ? '…' : METHOD_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connected integrations (C2/C3) */}
      <div className="flex flex-col gap-1.5 rounded-[6px] p-1.5" style={{ border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.4))' }}>
        <span className="text-[7.5px] font-mono uppercase tracking-[0.14em]" style={{ color: 'var(--ds-metal-300)' }}>Connected ({refs.length})</span>
        {refs.length === 0 && <span className="text-[8.5px] font-mono px-1 py-1.5 text-center" style={{ color: 'var(--ds-text-low)' }}>Search a platform and connect</span>}
        {refs.map((r) => {
          const avail = assetsByPlatform[r.platformId] ?? [];
          return (
            <div key={r.id} data-role="int-connected" data-platform-id={r.platformId} data-has-ref={r.capabilityRef?.refId ? 'true' : 'false'} className="flex flex-col gap-1 px-1.5 py-1 rounded-[5px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1.5">
                <BrandLogo brandKey={r.contentIcon?.brandKey ?? r.platformId} size={16} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[9.5px] font-mono truncate" style={{ color: 'var(--ds-text-hi)' }}>{r.platform}</span>
                  <span className="text-[7px] font-mono truncate" style={{ color: 'var(--ds-text-low)' }} data-role="int-capref" title={r.capabilityRef?.refId}>
                    <Icon name="lock" size={7} color="#5fce8e" /> {METHOD_LABEL[r.authMethod]} · ref {r.capabilityRef?.refId?.slice(0, 18)}… (no token)
                  </span>
                </div>
                <button type="button" data-role="int-detach" onClick={() => detach(r.id)} className="p-0.5 rounded hover:bg-white/10"><Icon name="close" size={9} color="var(--ds-text-low)" /></button>
              </div>
              {/* Added assets */}
              {(r.assets ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 pl-5">
                  {(r.assets ?? []).map((a) => (
                    <span key={a.id} data-role="int-asset-added" className="flex items-center gap-1 text-[8px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--ds-text-hi)', background: 'rgba(95,206,142,0.12)' }}>
                      {a.name}
                      <button type="button" onClick={() => removeAsset(r.id, a.id)} className="opacity-70 hover:opacity-100"><Icon name="close" size={7} color="var(--ds-text-low)" /></button>
                    </span>
                  ))}
                </div>
              )}
              {/* Available assets to add (C3) */}
              {avail.length > 0 && (
                <div className="flex flex-col gap-0.5 pl-5" data-role="int-asset-list"
                  onDragOver={(e) => e.preventDefault()}>
                  <span className="text-[6.5px] font-mono uppercase tracking-[0.12em]" style={{ color: 'var(--ds-text-low)' }}>your {r.platform} assets — click to add</span>
                  {avail.map((a) => (
                    <button key={a.id} type="button" data-role="int-asset-available" data-asset-id={a.id} draggable onDragStart={(e) => e.dataTransfer.setData('application/x-int-asset', JSON.stringify(a))} onClick={() => addAsset(r.id, a)} className="flex items-center gap-1.5 text-[8.5px] font-mono px-1 py-0.5 rounded text-left hover:bg-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <Icon name="plus" size={8} color="var(--ds-metal-300)" />
                      <span className="flex-1 truncate" style={{ color: 'var(--ds-text-hi)' }}>{a.name}</span>
                      <span className="text-[7px]" style={{ color: 'var(--ds-text-low)' }}>{a.kind}{a.detail ? ` · ${a.detail}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dedupe(arr: IntegrationAsset[]): IntegrationAsset[] {
  const seen = new Set<string>();
  return arr.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

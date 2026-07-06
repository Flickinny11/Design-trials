'use client';

// PRISM SHELL-W10 — Generate capability family, surfaced as an ADDITIVE section
// inside the Functions tab (founder law: "Tiles in Functions tab under a Generate
// category"). Object generation, PBR texturing, auto-rig, part segmentation, PBR
// material, world (stub), mesh-ops (stub) — tiles named MODEL + FUNCTION with
// DL14 glyphs. The client never imports an adapter (INV-NEV2-4): every call goes
// to /api/prism/generative, which dispatches to the provider-agnostic registry.
//
// Flow: pick a capability tile → params form → submit → poll job progress →
// result asset → attach to the node (node.generativeAssets) or "Use as mesh"
// (meshUrl/renderMode='mesh' — the node becomes the generated object in-scene).
// A dev-grade usage ledger (E20 metering) lists recorded events + totals.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode, GenerativeAssetAttachment } from '@/lib/prism-graph/types';
import type {
  GenerativeCapabilityDescriptor,
  GenerativeCapabilityKind,
  GenerativeJob,
  CapabilityUsageEvent,
} from '@/lib/capabilities/generative';
import { GENERATIVE_GROUPS } from '@/lib/capabilities/generative-catalog';

const KIND_GLYPH: Record<GenerativeCapabilityKind, string> = {
  generate3D: 'gen3d', textureMesh: 'genTexture', rigMesh: 'genRig',
  segmentMesh: 'genSegment', generateMaterial: 'genMaterial',
  generateWorld: 'genWorld', meshOps: 'genMeshOps',
};

const RED = '#e0795f';
const API = '/api/prism/generative';

function costLabel(c: { unit: 'credits' | 'usd'; estimate: number }): string {
  return c.unit === 'credits' ? `${c.estimate} cr` : `$${c.estimate.toFixed(2)}`;
}
function hash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export default function GeneratePanel({ node, onToast }: { node: PrismNode; onToast?: (m: string) => void }) {
  const updateNode = useGraphSourceStore((s) => s.updateNode);
  const saveToServer = useGraphSourceStore((s) => s.saveToServer);

  const [open, setOpen] = useState(false);
  const [caps, setCaps] = useState<GenerativeCapabilityDescriptor[]>([]);
  const [selected, setSelected] = useState<GenerativeCapabilityDescriptor | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [demoMode, setDemoMode] = useState(true); // prototype safety: no credit spend by default
  const [job, setJob] = useState<GenerativeJob | null>(null);
  const [meshJobs, setMeshJobs] = useState<GenerativeJob[]>([]);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState<{ events: CapabilityUsageEvent[]; totals: { credits: number; usd: number; count: number } } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const attached = node.generativeAssets ?? [];

  // Load the catalog (live flags stamped server-side) + prior mesh jobs for this node.
  const loadJobs = useCallback(async () => {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'jobs', nodeId: node.nodeId }) });
      const d = await r.json();
      if (d.ok) setMeshJobs((d.jobs as GenerativeJob[]).filter((j) => j.status === 'succeeded' && j.result?.kind === 'glb'));
    } catch { /* ignore */ }
  }, [node.nodeId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'listCapabilities' }) });
        const d = await r.json();
        if (alive && d.ok) setCaps(d.capabilities as GenerativeCapabilityDescriptor[]);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (open) void loadJobs(); }, [open, loadJobs]);

  // Poll the active job to completion.
  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'poll', jobId: job.jobId }) });
        const d = await r.json();
        if (d.ok) {
          setJob(d.job as GenerativeJob);
          if (d.job.status === 'succeeded' || d.job.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            if (d.job.status === 'succeeded') void loadJobs();
          }
        }
      } catch { /* keep polling */ }
    }, 1100);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job, loadJobs]);

  const pickCapability = useCallback((c: GenerativeCapabilityDescriptor) => {
    setSelected(c);
    setJob(null);
    const init: Record<string, unknown> = {};
    for (const p of c.params) if (p.default !== undefined) init[p.name] = p.default;
    setParams(init);
  }, []);

  const submit = useCallback(async () => {
    if (!selected) return;
    const body = { op: 'submit', capabilityId: selected.capabilityId, nodeId: node.nodeId, params: { ...params, ...(demoMode ? { __demo: true } : {}) } };
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) { setJob(d.job as GenerativeJob); onToast?.(`${selected.model} — ${selected.fn} started`); }
      else onToast?.(d.error ?? 'submit failed');
    } catch (e) { onToast?.((e as Error).message); }
  }, [selected, params, demoMode, node.nodeId, onToast]);

  const attach = useCallback(async (j: GenerativeJob) => {
    if (!j.result) return;
    const asset: GenerativeAssetAttachment = {
      id: `ga-${hash(j.jobId + j.result.url)}`, capabilityId: j.capabilityId, model: j.model,
      kind: j.result.kind, url: j.result.url, label: j.result.label,
      createdAt: new Date().toISOString(),
      meta: { jobId: j.jobId, live: j.live, cost: j.cost ? `${j.cost.amount} ${j.cost.unit}` : '' },
    };
    const cur = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === node.nodeId)?.generativeAssets ?? [];
    if (cur.some((a) => a.id === asset.id)) { onToast?.('Already attached'); return; }
    updateNode(node.nodeId, { generativeAssets: [...cur, asset] });
    try { await saveToServer?.(); } catch { /* autosave retries */ }
    onToast?.(`Attached ${asset.label}`);
  }, [node.nodeId, updateNode, saveToServer, onToast]);

  const useAsMesh = useCallback(async (asset: GenerativeAssetAttachment) => {
    updateNode(node.nodeId, { meshUrl: asset.url, renderMode: 'mesh' });
    try { await saveToServer?.(); } catch { /* ignore */ }
    onToast?.(`${asset.label} → node mesh`);
  }, [node.nodeId, updateNode, saveToServer, onToast]);

  const removeAsset = useCallback(async (id: string) => {
    const cur = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === node.nodeId)?.generativeAssets ?? [];
    updateNode(node.nodeId, { generativeAssets: cur.filter((a) => a.id !== id) });
    try { await saveToServer?.(); } catch { /* ignore */ }
  }, [node.nodeId, updateNode, saveToServer]);

  const loadLedger = useCallback(async () => {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'ledger' }) });
      const d = await r.json();
      if (d.ok) setLedger(d.ledger);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (ledgerOpen) void loadLedger(); }, [ledgerOpen, loadLedger]);

  return (
    <div data-component="generate-panel" className="flex flex-col gap-2 rounded-[6px] p-1.5" style={{ background: 'rgba(224,121,95,0.04)', border: '1px solid rgba(224,121,95,0.22)' }}>
      {/* Section header */}
      <button type="button" data-role="gen-toggle" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 px-0.5 py-0.5">
        <Icon name="gen3d" size={15} color={RED} />
        <span className="text-[9px] font-mono uppercase tracking-[0.16em] flex-1 text-left" style={{ color: 'var(--ds-text-hi)' }}>Generate · 3D</span>
        <span className="text-[7px] font-mono uppercase tracking-[0.1em]" style={{ color: 'var(--ds-text-low)' }}>{caps.length} models</span>
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}><Icon name="chevron" size={9} color="var(--ds-text-low)" /></span>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {/* demo-mode safety toggle (prototype: avoids real credit spend) */}
          <label data-role="gen-demo" className="flex items-center gap-1.5 px-1 cursor-pointer">
            <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} className="accent-[#e0795f] w-2.5 h-2.5" />
            <span className="text-[8px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>Demo mode — sample results, no credits spent</span>
          </label>

          {/* Tile grid, grouped by kind */}
          {GENERATIVE_GROUPS.map((g) => {
            const rows = caps.filter((c) => c.kind === g.kind);
            if (!rows.length) return null;
            return (
              <div key={g.kind} className="flex flex-col gap-1">
                <span className="text-[7px] font-mono uppercase tracking-[0.16em] px-0.5" style={{ color: 'var(--ds-metal-300)' }}>{g.label}</span>
                <div className="grid grid-cols-2 gap-1">
                  {rows.map((c) => {
                    const active = selected?.capabilityId === c.capabilityId;
                    return (
                      <button
                        key={c.capabilityId}
                        type="button"
                        data-role="gen-tile"
                        data-capability={c.capabilityId}
                        data-live={c.live ? '1' : '0'}
                        onClick={() => pickCapability(c)}
                        title={c.description}
                        className="flex flex-col gap-0.5 p-1.5 rounded-[5px] text-left transition-colors"
                        style={{ background: active ? 'rgba(224,121,95,0.14)' : 'rgba(255,255,255,0.03)', border: active ? '1px solid rgba(224,121,95,0.5)' : '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon name={KIND_GLYPH[c.kind]} size={16} color={c.live ? RED : 'var(--ds-metal-300)'} />
                          <span className="text-[8.5px] font-mono font-semibold truncate flex-1" style={{ color: 'var(--ds-text-hi)' }}>{c.model}</span>
                        </div>
                        <span className="text-[7.5px] font-mono truncate" style={{ color: 'var(--ds-text-mid)' }}>{c.fn}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[6.5px] font-mono uppercase tracking-[0.08em] px-1 py-[1px] rounded-[3px]" style={{ background: c.live ? 'rgba(95,206,142,0.14)' : 'rgba(255,255,255,0.05)', color: c.live ? '#5fce8e' : 'var(--ds-text-low)' }}>{c.live ? 'live' : 'connect'}</span>
                          <span className="text-[6.5px] font-mono ml-auto tabular-nums" style={{ color: 'var(--ds-text-low)' }}>{costLabel(c.costBasis)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Invoke form for the selected capability */}
          {selected && (
            <div data-role="gen-invoke" className="flex flex-col gap-1.5 rounded-[6px] p-1.5" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-1.5">
                <Icon name={KIND_GLYPH[selected.kind]} size={14} color={RED} />
                <span className="text-[9px] font-mono font-semibold flex-1" style={{ color: 'var(--ds-text-hi)' }}>{selected.label}</span>
                <button type="button" data-role="gen-close" onClick={() => setSelected(null)} className="p-0.5 rounded hover:bg-white/10"><Icon name="close" size={9} color="var(--ds-text-low)" /></button>
              </div>
              {selected.params.map((p) => (
                <div key={p.name} className="flex flex-col gap-0.5">
                  <label className="text-[7px] font-mono uppercase tracking-[0.1em]" style={{ color: 'var(--ds-text-low)' }}>{p.label}{p.required ? ' *' : ''}</label>
                  {p.type === 'select' ? (
                    <select data-role={`gen-p-${p.name}`} value={String(params[p.name] ?? p.default ?? '')} onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.value }))} className="ds-well rounded-[4px] px-1.5 py-1 bg-transparent outline-none text-[9px] font-mono" style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-well)' }}>
                      {(p.options ?? []).map((o) => <option key={o} value={o} style={{ background: '#1a1a1e' }}>{o}</option>)}
                    </select>
                  ) : p.type === 'boolean' ? (
                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" data-role={`gen-p-${p.name}`} checked={params[p.name] !== false} onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.checked }))} className="accent-[#e0795f] w-2.5 h-2.5" /><span className="text-[8px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>enabled</span></label>
                  ) : p.type === 'sourceJob' ? (
                    <select data-role={`gen-p-${p.name}`} value={String(params[p.name] ?? '')} onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.value }))} className="ds-well rounded-[4px] px-1.5 py-1 bg-transparent outline-none text-[9px] font-mono" style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-well)' }}>
                      <option value="" style={{ background: '#1a1a1e' }}>{meshJobs.length ? 'Pick a generated mesh…' : 'Generate a mesh first'}</option>
                      {meshJobs.map((j) => <option key={j.jobId} value={j.jobId} style={{ background: '#1a1a1e' }}>{j.model} · {j.jobId.slice(-6)}</option>)}
                    </select>
                  ) : (
                    <input data-role={`gen-p-${p.name}`} type={p.type === 'number' ? 'number' : 'text'} value={String(params[p.name] ?? '')} placeholder={p.placeholder} onChange={(e) => setParams((s) => ({ ...s, [p.name]: e.target.value }))} className="ds-well rounded-[4px] px-1.5 py-1 bg-transparent outline-none text-[9px] font-mono" style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-well)' }} />
                  )}
                </div>
              ))}
              <button type="button" data-role="gen-submit" onClick={submit} disabled={!!job && (job.status === 'queued' || job.status === 'running')} className="flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[9px] font-mono font-semibold disabled:opacity-40" style={{ color: '#fff', background: 'linear-gradient(180deg,#e88a72,#c9583f)' }}>
                <Icon name="sparkle" size={10} color="#fff" />
                {demoMode ? 'Generate (demo)' : `Generate · ${costLabel(selected.costBasis)}`}
              </button>
            </div>
          )}

          {/* Active job progress + result */}
          {job && (
            <div data-role="gen-job" data-status={job.status} className="flex flex-col gap-1 rounded-[6px] p-1.5" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono flex-1 truncate" style={{ color: 'var(--ds-text-hi)' }}>{job.model}</span>
                <span className="text-[7px] font-mono uppercase tracking-[0.1em]" style={{ color: job.status === 'succeeded' ? '#5fce8e' : job.status === 'failed' ? RED : '#d9b878' }}>{job.status}</span>
              </div>
              {(job.status === 'queued' || job.status === 'running') && (
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}><div data-role="gen-progress" style={{ width: `${job.progress}%`, height: '100%', background: 'linear-gradient(90deg,#e88a72,#c9583f)', transition: 'width 300ms' }} /></div>
              )}
              {job.status === 'failed' && <span className="text-[7.5px] font-mono" style={{ color: RED }}>{job.error}</span>}
              {job.status === 'succeeded' && job.result && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Icon name={KIND_GLYPH[selected?.kind ?? 'generate3D']} size={14} color="#5fce8e" />
                    <span className="text-[8.5px] font-mono flex-1 truncate" style={{ color: 'var(--ds-text-hi)' }}>{job.result.label}</span>
                    {job.cost && <span className="text-[7px] font-mono tabular-nums" style={{ color: 'var(--ds-text-low)' }}>{job.cost.amount} {job.cost.unit}{job.cost.estimated ? ' est' : ''}</span>}
                  </div>
                  <button type="button" data-role="gen-attach" onClick={() => attach(job)} className="flex items-center justify-center gap-1.5 rounded-[4px] px-2 py-1 text-[8.5px] font-mono" style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-metal, linear-gradient(180deg,#dfe2e6,#898c92))' }}><Icon name="plus" size={9} color="var(--ds-text-hi)" />Attach to node</button>
                </div>
              )}
            </div>
          )}

          {/* Attached generated assets */}
          {attached.length > 0 && (
            <div className="flex flex-col gap-1 rounded-[6px] p-1.5" style={{ border: '1px dashed rgba(255,255,255,0.14)' }}>
              <span className="text-[7px] font-mono uppercase tracking-[0.14em] px-0.5" style={{ color: 'var(--ds-metal-300)' }}>Generated assets ({attached.length})</span>
              {attached.map((a) => (
                <div key={a.id} data-role="gen-asset" data-kind={a.kind} className="flex items-center gap-1.5 px-1.5 py-1 rounded-[5px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Icon name={KIND_GLYPH[kindOf(a.kind)]} size={13} color={RED} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[8.5px] font-mono truncate" style={{ color: 'var(--ds-text-hi)' }}>{a.label}</span>
                    <span className="text-[7px] font-mono truncate" style={{ color: 'var(--ds-text-low)' }}>{a.model} · {a.kind}</span>
                  </div>
                  {(a.kind === 'glb' || a.kind === 'rig' || a.kind === 'segments') && (
                    <button type="button" data-role="gen-use-mesh" title="Use as node mesh" onClick={() => useAsMesh(a)} className="p-0.5 rounded hover:bg-white/10"><Icon name="cube" size={11} color="var(--ds-metal-300)" /></button>
                  )}
                  <button type="button" data-role="gen-remove" title="Remove" onClick={() => removeAsset(a.id)} className="p-0.5 rounded hover:bg-white/10"><Icon name="close" size={9} color="var(--ds-text-low)" /></button>
                </div>
              ))}
            </div>
          )}

          {/* Usage ledger (E20 metering, dev-grade) */}
          <div className="flex flex-col gap-1">
            <button type="button" data-role="gen-ledger-toggle" onClick={() => setLedgerOpen((o) => !o)} className="flex items-center gap-1.5 px-0.5">
              <Icon name="chart" size={11} color="var(--ds-text-low)" />
              <span className="text-[7.5px] font-mono uppercase tracking-[0.14em] flex-1 text-left" style={{ color: 'var(--ds-metal-300)' }}>Usage ledger</span>
              {ledger && <span className="text-[7px] font-mono tabular-nums" style={{ color: 'var(--ds-text-low)' }}>{ledger.totals.credits} cr · ${ledger.totals.usd.toFixed(2)}</span>}
            </button>
            {ledgerOpen && ledger && (
              <div data-role="gen-ledger" className="flex flex-col gap-0.5 max-h-[140px] overflow-y-auto rounded-[5px] p-1" style={{ background: 'rgba(0,0,0,0.28)' }}>
                {ledger.events.length === 0 && <span className="text-[7.5px] font-mono px-1 py-1" style={{ color: 'var(--ds-text-low)' }}>No usage recorded yet.</span>}
                {ledger.events.slice(0, 24).map((e) => (
                  <div key={e.id} className="flex items-center gap-1.5 px-1 py-0.5">
                    <span className="text-[7px] font-mono flex-1 truncate" style={{ color: 'var(--ds-text-mid)' }}>{e.model}</span>
                    {e.ok === false && <span className="text-[6.5px] font-mono uppercase" style={{ color: RED }}>failed</span>}
                    <span className="text-[6.5px] font-mono uppercase" style={{ color: e.live ? '#5fce8e' : 'var(--ds-text-low)' }}>{e.live ? 'live' : 'demo'}</span>
                    <span className="text-[7px] font-mono tabular-nums" style={{ color: 'var(--ds-text-low)' }}>{e.costBasis.amount} {e.costBasis.unit === 'credits' ? 'cr' : '$'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Map an asset kind back to a capability kind (for the attached-asset glyph).
function kindOf(assetKind: string): GenerativeCapabilityKind {
  switch (assetKind) {
    case 'texture-set': return 'textureMesh';
    case 'material': return 'generateMaterial';
    case 'rig': return 'rigMesh';
    case 'segments': return 'segmentMesh';
    case 'world': return 'generateWorld';
    default: return 'generate3D';
  }
}

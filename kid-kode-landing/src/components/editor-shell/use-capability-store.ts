'use client';

// PRISM WORKSPACE COMPLETION — W-2: the CAPABILITY controller (Functions /
// Integrations / Data).
//
// One cohesive client store for the in-engine node editor's capability layer.
// It owns the TRANSIENT UI (which node-editor section is showing, the search
// queries + branded results, the connecting flag, the saved-asset caches, the
// user's snippets) AND the node mutations that attach capability to the SELECTED
// node on the LIVE app graph (functionTiles / integrationRefs / dataModel via
// useGraphSourceStore.updateNode — which schedules the durable autosave, so
// every attach/detach/reorder round-trips through save/reload, INV-W5).
//
// SECURITY (INV-W7): every catalog call goes through /api/prism/capabilities (the
// server dispatches to the active CapabilityProvider — MCP reference offline,
// Nango when keyed). Auth yields a capability REFERENCE only; the route redacts
// any secret-looking field before it leaves the server. This store never holds,
// and never logs, a raw token. Editor CHROME — not a graph node; the
// authorship gate ignores it. Window access here is the editor-chrome exemption.

import { create } from 'zustand';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useEditorShellStore } from './use-editor-shell-store';
import type { ActionTileDescriptor, PlatformDescriptor } from '@/lib/capabilities/provider';
import type {
  PrismNode,
  FunctionTile,
  IntegrationRef,
  IntegrationAsset,
  IntegrationAuthMethod,
  CapabilityRef,
  PrismDataModel,
  PrismDataField,
  PrismPersistenceBinding,
} from '@/lib/prism-graph/types';

// ── the per-node DATA section persistence is wired only from db/storage
//    providers; this is the client-side category filter for the Data tab search.
const DATA_CATEGORIES = new Set(['Data', 'Infra']);

export type NodeEditorSection = 'purpose' | 'functions' | 'integrations' | 'data';
const USER_ID = 'local-user';

export interface SnippetRow {
  id: string;
  name: string;
  brandKey: string;
  platform: string;
  label: string;
  actionId: string;
  providerId: string;
}

const CAP_URL = '/api/prism/capabilities';
const SNIP_URL = '/api/prism/snippets';

// Per-surface SEQUENTIAL search chain: a live-typing field must never fire
// concurrent requests (that overloads the dev route + races on which response
// wins). Every search links onto the surface's chain so requests run one at a
// time; each run checks it is still the latest-requested query (the surface's
// *Query field, set synchronously at call time) before fetching AND before
// applying — so intermediate keystrokes skip entirely and only the latest query
// fetches + applies. Callers can await their own run for a reliable result.
let fnChain: Promise<void> = Promise.resolve();
let platformChain: Promise<void> = Promise.resolve();
let dataChain: Promise<void> = Promise.resolve();

async function capPost(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(CAP_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return data?.ok ? data : null;
  } catch {
    return null;
  }
}

// fresh node read (never a stale closure snapshot).
function freshNode(id: string | null): PrismNode | undefined {
  if (!id) return undefined;
  return useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
}
function selectedId(): string | null {
  return useEditorShellStore.getState().selectedId;
}
function writeNode(id: string, patch: Partial<PrismNode>): void {
  useGraphSourceStore.getState().updateNode(id, patch);
}
function hashId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

interface CapabilityState {
  // ── which node-editor section is showing ──────────────────────────────────
  section: NodeEditorSection;
  setSection: (s: NodeEditorSection) => void;

  // ── FUNCTIONS search (capability-first) ───────────────────────────────────
  fnQuery: string;
  fnResults: ActionTileDescriptor[];
  fnProviderId: string;
  fnLive: boolean;
  searchActions: (q: string) => Promise<void>;

  // ── INTEGRATIONS search ───────────────────────────────────────────────────
  intQuery: string;
  intPlatforms: PlatformDescriptor[];
  intLive: boolean;
  connecting: string | null;
  assetsByPlatform: Record<string, IntegrationAsset[]>;
  searchPlatforms: (q: string) => Promise<void>;

  // ── DATA search (db/storage only) ─────────────────────────────────────────
  dataQuery: string;
  dataPlatforms: PlatformDescriptor[];
  searchDataPlatforms: (q: string) => Promise<void>;

  // ── snippets (per-user, reusable across builds) ───────────────────────────
  snippets: SnippetRow[];
  loadSnippets: () => Promise<void>;
  saveSnippet: (name: string) => Promise<void>;

  // ── node mutations: FUNCTIONS (criteria D2) ───────────────────────────────
  attachFunctionTile: (d: AttachDescriptor) => Promise<string | null>;
  detachFunctionTile: (tileId: string) => void;
  reorderFunctionTile: (tileId: string, dir: -1 | 1) => void;
  validateFunctionTile: (tileId: string) => Promise<void>;

  // ── node mutations: INTEGRATIONS (criteria D3) ────────────────────────────
  connectIntegration: (p: PlatformDescriptor, method: IntegrationAuthMethod) => Promise<string | null>;
  detachIntegration: (refId: string) => void;
  addIntegrationAsset: (refId: string, asset: IntegrationAsset) => void;
  removeIntegrationAsset: (refId: string, assetId: string) => void;

  // ── node mutations: DATA (criteria C3) ────────────────────────────────────
  setDataModelName: (name: string) => void;
  setDataFields: (fields: PrismDataField[]) => void;
  bindPersistence: (p: PlatformDescriptor, method: IntegrationAuthMethod, kind?: string) => Promise<void>;
  unbindPersistence: () => void;
  bindPersistenceResource: (resource: string) => void;
  validateDataBinding: () => Promise<void>;
}

export interface AttachDescriptor {
  actionId: string;
  brandKey: string;
  label: string;
  platform: string;
  providerId?: string;
  params?: Record<string, unknown>;
  source?: 'catalog' | 'snippet';
  snippetId?: string;
}

export const useCapabilityStore = create<CapabilityState>((set, get) => ({
  section: 'purpose',
  setSection: (section) => set({ section }),

  fnQuery: '',
  fnResults: [],
  fnProviderId: 'mcp',
  fnLive: false,
  searchActions: async (q) => {
    set({ fnQuery: q });
    const run = fnChain.then(async () => {
      if (get().fnQuery !== q) return; // a newer query was requested after this one
      const data = await capPost({ op: 'searchActions', query: q.trim() });
      if (get().fnQuery !== q || !data) return; // superseded while fetching, or failed
      set({
        fnResults: (data.tiles as ActionTileDescriptor[]) ?? [],
        fnLive: !!data.live,
        fnProviderId: (data.provider as string) ?? 'mcp',
      });
    });
    fnChain = run.catch(() => {});
    await run;
  },

  intQuery: '',
  intPlatforms: [],
  intLive: false,
  connecting: null,
  assetsByPlatform: {},
  searchPlatforms: async (q) => {
    set({ intQuery: q });
    const run = platformChain.then(async () => {
      if (get().intQuery !== q) return;
      const data = await capPost({ op: 'searchPlatforms', query: q.trim() });
      if (get().intQuery !== q || !data) return;
      set({ intPlatforms: (data.platforms as PlatformDescriptor[]) ?? [], intLive: !!data.live });
    });
    platformChain = run.catch(() => {});
    await run;
  },

  dataQuery: '',
  dataPlatforms: [],
  searchDataPlatforms: async (q) => {
    set({ dataQuery: q });
    const run = dataChain.then(async () => {
      if (get().dataQuery !== q) return;
      const data = await capPost({ op: 'searchPlatforms', query: q.trim() });
      if (get().dataQuery !== q || !data) return;
      const all = (data.platforms as PlatformDescriptor[]) ?? [];
      set({ dataPlatforms: all.filter((p) => !p.category || DATA_CATEGORIES.has(p.category)) });
    });
    dataChain = run.catch(() => {});
    await run;
  },

  snippets: [],
  loadSnippets: async () => {
    try {
      const res = await fetch(`${SNIP_URL}?userId=${USER_ID}`);
      const data = await res.json();
      if (data?.ok) set({ snippets: (data.snippets as SnippetRow[]) ?? [] });
    } catch {
      /* ignore */
    }
  },
  saveSnippet: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = selectedId();
    const tiles = (freshNode(id)?.functionTiles ?? []).slice().sort((a, b) => a.order - b.order);
    const seed = tiles[0];
    try {
      const res = await fetch(SNIP_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          name: trimmed,
          providerId: seed?.providerId ?? 'custom',
          actionId: seed?.actionId ?? 'custom-action',
          brandKey: seed?.brandKey ?? 'custom',
          platform: seed?.platform ?? 'Custom',
          label: seed?.label ?? trimmed,
          params: seed?.params,
        }),
      });
      const data = await res.json();
      if (data?.ok) await get().loadSnippets();
    } catch {
      /* ignore */
    }
  },

  // ── FUNCTIONS node mutations ───────────────────────────────────────────────
  attachFunctionTile: async (d) => {
    const id = selectedId();
    if (!id) return null;
    const existing = freshNode(id)?.functionTiles ?? [];
    const order = existing.length ? Math.max(...existing.map((t) => t.order)) + 1 : 0;
    const tileId = hashId('ft', id + d.actionId + order);
    const tile: FunctionTile = {
      id: tileId,
      order,
      providerId: d.providerId ?? get().fnProviderId ?? 'mcp',
      actionId: d.actionId,
      brandKey: d.brandKey,
      label: d.label,
      platform: d.platform,
      source: d.source ?? 'catalog',
      snippetId: d.snippetId,
      params: d.params,
      validation: { status: 'unvalidated' },
    };
    writeNode(id, { functionTiles: [...existing, tile] });
    void get().validateFunctionTile(tileId); // validate-on-select (D4)
    return tileId;
  },
  detachFunctionTile: (tileId) => {
    const id = selectedId();
    if (!id) return;
    const tiles = (freshNode(id)?.functionTiles ?? []).filter((t) => t.id !== tileId);
    writeNode(id, { functionTiles: tiles.sort((a, b) => a.order - b.order).map((t, i) => ({ ...t, order: i })) });
  },
  reorderFunctionTile: (tileId, dir) => {
    const id = selectedId();
    if (!id) return;
    const arr = (freshNode(id)?.functionTiles ?? []).slice().sort((a, b) => a.order - b.order);
    const i = arr.findIndex((t) => t.id === tileId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    writeNode(id, { functionTiles: arr.map((t, k) => ({ ...t, order: k })) });
  },
  validateFunctionTile: async (tileId) => {
    const id = selectedId();
    if (!id) return;
    const patchTile = (patch: Partial<FunctionTile>) => {
      const tiles = (freshNode(id)?.functionTiles ?? []).map((t) => (t.id === tileId ? { ...t, ...patch } : t));
      writeNode(id, { functionTiles: tiles });
    };
    const tile = (freshNode(id)?.functionTiles ?? []).find((t) => t.id === tileId);
    if (!tile) return;
    patchTile({ validation: { status: 'validating' } });
    const data = await capPost({ op: 'validateAction', actionId: tile.actionId, params: tile.params });
    const r = data?.result as
      | { ok: boolean; status: string; message: string; autoFix?: { params: Record<string, unknown>; note: string } }
      | undefined;
    const now = new Date().toISOString();
    if (r?.ok) {
      patchTile({ validation: { status: 'valid', testedAt: now, message: r.message } });
    } else if (r?.autoFix) {
      patchTile({ params: r.autoFix.params, validation: { status: 'fixed', testedAt: now, message: r.message, autoFixNote: r.autoFix.note } });
    } else {
      patchTile({ validation: { status: 'broken', testedAt: now, message: r?.message ?? 'validation failed' } });
    }
  },

  // ── INTEGRATIONS node mutations ────────────────────────────────────────────
  connectIntegration: async (p, method) => {
    const id = selectedId();
    if (!id) return null;
    set({ connecting: p.platformId });
    try {
      const data = await capPost({ op: 'connect', platformId: p.platformId, method });
      const r = data?.result as { ok: boolean; capabilityRef?: CapabilityRef; message: string } | undefined;
      if (!r?.ok || !r.capabilityRef) return null;
      const existing = freshNode(id)?.integrationRefs ?? [];
      const order = existing.length ? Math.max(...existing.map((x) => x.order)) + 1 : 0;
      const refId = hashId('ig', id + p.platformId + order);
      const ref: IntegrationRef = {
        id: refId,
        order,
        providerId: get().fnProviderId ?? 'mcp',
        platformId: p.platformId,
        platform: p.platform,
        authMethod: method,
        capabilityRef: r.capabilityRef,
        assets: [],
        contentIcon: { brandKey: p.brandKey },
      };
      writeNode(id, { integrationRefs: [...existing, ref] });
      // self-populate the user's saved assets (D3).
      const ad = await capPost({ op: 'listAssets', platformId: p.platformId, capabilityRef: r.capabilityRef });
      if (ad) set((s) => ({ assetsByPlatform: { ...s.assetsByPlatform, [p.platformId]: (ad.assets as IntegrationAsset[]) ?? [] } }));
      return refId;
    } finally {
      set({ connecting: null });
    }
  },
  detachIntegration: (refId) => {
    const id = selectedId();
    if (!id) return;
    const refs = (freshNode(id)?.integrationRefs ?? []).filter((r) => r.id !== refId);
    writeNode(id, { integrationRefs: refs.sort((a, b) => a.order - b.order).map((r, i) => ({ ...r, order: i })) });
  },
  addIntegrationAsset: (refId, asset) => {
    const id = selectedId();
    if (!id) return;
    const refs = (freshNode(id)?.integrationRefs ?? []).map((r) =>
      r.id === refId ? { ...r, assets: dedupeAssets([...(r.assets ?? []), asset]) } : r,
    );
    writeNode(id, { integrationRefs: refs });
  },
  removeIntegrationAsset: (refId, assetId) => {
    const id = selectedId();
    if (!id) return;
    const refs = (freshNode(id)?.integrationRefs ?? []).map((r) =>
      r.id === refId ? { ...r, assets: (r.assets ?? []).filter((a) => a.id !== assetId) } : r,
    );
    writeNode(id, { integrationRefs: refs });
  },

  // ── DATA node mutations ────────────────────────────────────────────────────
  setDataModelName: (name) => {
    const id = selectedId();
    if (!id) return;
    const dm = freshNode(id)?.dataModel ?? {};
    writeNode(id, { dataModel: { ...dm, name } });
  },
  setDataFields: (fields) => {
    const id = selectedId();
    if (!id) return;
    const dm = freshNode(id)?.dataModel ?? {};
    writeNode(id, { dataModel: { ...dm, fields } });
  },
  bindPersistence: async (p, method, kind = 'table') => {
    const id = selectedId();
    if (!id) return;
    set({ connecting: p.platformId });
    try {
      const data = await capPost({ op: 'connect', platformId: p.platformId, method });
      const r = data?.result as { ok: boolean; capabilityRef?: CapabilityRef; message: string } | undefined;
      if (!r?.ok || !r.capabilityRef) return;
      const dm = freshNode(id)?.dataModel ?? {};
      const persistence: PrismPersistenceBinding = {
        providerId: get().fnProviderId ?? 'mcp',
        platformId: p.platformId,
        platform: p.platform,
        kind,
        brandKey: p.brandKey,
        capabilityRef: r.capabilityRef,
      };
      writeNode(id, { dataModel: { ...dm, persistence } });
      // self-populate saved assets so the user can bind a concrete resource.
      const ad = await capPost({ op: 'listAssets', platformId: p.platformId, capabilityRef: r.capabilityRef });
      if (ad) set((s) => ({ assetsByPlatform: { ...s.assetsByPlatform, [p.platformId]: (ad.assets as IntegrationAsset[]) ?? [] } }));
      void get().validateDataBinding();
    } finally {
      set({ connecting: null });
    }
  },
  unbindPersistence: () => {
    const id = selectedId();
    if (!id) return;
    const dm = freshNode(id)?.dataModel ?? {};
    const { persistence: _drop, validation: _v, ...rest } = dm;
    writeNode(id, { dataModel: rest });
  },
  bindPersistenceResource: (resource) => {
    const id = selectedId();
    if (!id) return;
    const dm = freshNode(id)?.dataModel;
    if (!dm?.persistence) return;
    writeNode(id, { dataModel: { ...dm, persistence: { ...dm.persistence, resource } } });
  },
  validateDataBinding: async () => {
    const id = selectedId();
    if (!id) return;
    const dm = freshNode(id)?.dataModel;
    if (!dm?.persistence) return;
    const setVal = (validation: PrismDataModel['validation']) => {
      const cur = freshNode(id)?.dataModel;
      if (!cur) return;
      writeNode(id, { dataModel: { ...cur, validation } });
    };
    setVal({ status: 'validating' });
    // validate the bound action against the provider (reuses the sandbox path).
    const actionId = `${dm.persistence.platformId}-${dm.persistence.kind === 'bucket' ? 'put-object' : 'insert-row'}`;
    const data = await capPost({ op: 'validateAction', actionId, params: dm.persistence.resource ? { table: dm.persistence.resource } : {} });
    const r = data?.result as { ok: boolean; status: string; message: string } | undefined;
    const now = new Date().toISOString();
    if (r?.ok) setVal({ status: 'valid', testedAt: now, message: r.message });
    else setVal({ status: r ? 'fixed' : 'broken', testedAt: now, message: r?.message ?? 'binding stored (offline reference)' });
  },
}));

function dedupeAssets(arr: IntegrationAsset[]): IntegrationAsset[] {
  const seen = new Set<string>();
  return arr.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

// ── headless verification probe (editor chrome) ─────────────────────────────
// Installed once from the ALWAYS-mounted EditorInspectorDock so it survives tab
// switches. Every fn reads getState()/the live graph — never a stale snapshot.
// Lets the headless near-human pass drive the capability layer end-to-end and
// READ the selected node's attached capability (functions / integrations / data)
// straight off the shared store, proving round-trip without racing React.
export function installCapabilityProbe(): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as unknown as Record<string, unknown>;
  const cap = () => useCapabilityStore.getState();
  const sel = () => freshNode(selectedId());
  w.__PRISM_EDITOR_CAPABILITY__ = {
    // section
    section: () => cap().section,
    setSection: (s: NodeEditorSection) => cap().setSection(s),
    // selected node's attached capability (read straight off the live graph)
    summary: () => {
      const n = sel();
      return {
        nodeId: n?.nodeId ?? null,
        functionTiles: (n?.functionTiles ?? []).slice().sort((a, b) => a.order - b.order),
        integrationRefs: (n?.integrationRefs ?? []).slice().sort((a, b) => a.order - b.order),
        dataModel: n?.dataModel ?? null,
      };
    },
    // functions
    searchActions: (q: string) => cap().searchActions(q),
    fnResults: () => cap().fnResults,
    fnLive: () => cap().fnLive,
    fnProviderId: () => cap().fnProviderId,
    attachFunction: (d: AttachDescriptor) => cap().attachFunctionTile(d),
    reorderFunction: (id: string, dir: -1 | 1) => cap().reorderFunctionTile(id, dir),
    detachFunction: (id: string) => cap().detachFunctionTile(id),
    validateFunction: (id: string) => cap().validateFunctionTile(id),
    // integrations
    searchPlatforms: (q: string) => cap().searchPlatforms(q),
    intPlatforms: () => cap().intPlatforms,
    connect: (p: PlatformDescriptor, method: IntegrationAuthMethod) => cap().connectIntegration(p, method),
    detachIntegration: (id: string) => cap().detachIntegration(id),
    assets: (platformId: string) => cap().assetsByPlatform[platformId] ?? [],
    addAsset: (refId: string, asset: IntegrationAsset) => cap().addIntegrationAsset(refId, asset),
    // data
    searchDataPlatforms: (q: string) => cap().searchDataPlatforms(q),
    dataPlatforms: () => cap().dataPlatforms,
    setDataName: (name: string) => cap().setDataModelName(name),
    setDataFields: (fields: PrismDataField[]) => cap().setDataFields(fields),
    bindPersistence: (p: PlatformDescriptor, method: IntegrationAuthMethod, kind?: string) => cap().bindPersistence(p, method, kind),
    bindResource: (resource: string) => cap().bindPersistenceResource(resource),
    validateData: () => cap().validateDataBinding(),
    // snippets
    loadSnippets: () => cap().loadSnippets(),
    snippets: () => cap().snippets,
    saveSnippet: (name: string) => cap().saveSnippet(name),
  };
  return () => {
    delete w.__PRISM_EDITOR_CAPABILITY__;
  };
}

'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — THE LIBRARY STORE (spec §0 NODE LAW + §5 + §7).
//
// The single source of truth for the in-canvas library workspace. It is the UNIFIED
// canvas spine: it holds the browsable UI state (active section / family / search /
// view) AND every instantiated CANVAS instance, composing the PURE factories from
// every prior phase rather than bridging four separate stores:
//   • primitive  — a P-1 PrimitiveSchema (Pane / Cube / Sphere, optionally wearing a
//                  P-2 registry material by id → a "material display").
//   • fluid      — a P-3 FluidSchema (the living liquid-glass surface).
//   • composite  — a P-4/P-5 CompositeSchema (a SUBGRAPH instantiated as a unit).
//
// NODE LAW (§0 / INV-0.3 / INV-0.4): dropping an entry from the palette creates its
// backing node(s) AND renders them in the same action — `nodes()` projects EVERY
// instance to real PrismNode(s) (primitives/fluids → 1; composites → N members), so
// the node-authorship gate (--library) sees a genuine backing node for every render.
//
// Isolated editor-chrome — never the unified production graph scene. Window access is
// fine here (FP-05 scopes the ban to runtime/node/player paths).

import { create } from 'zustand';
import type { PrismNode } from '@/lib/prism-graph/types';
import {
  makeSchema as makePrimSchema,
  schemaToNode as primToNode,
  resetMintCounters as resetPrimCounters,
  type PrimitiveKind,
  type PrimitiveMaterial,
  type PrimitiveParams,
  type PrimitiveSchema,
  type PrimitiveTransform,
} from '@/components/editor/primitive/primitive-schema';
import {
  makeSchema as makeFluidSchema,
  schemaToNode as fluidToNode,
  resetMintCounters as resetFluidCounters,
  type FluidKind,
  type FluidParams,
  type FluidSchema,
} from '@/components/editor/fluid/fluid-schema';
import {
  makeComposite,
  compositeMembers,
  memberToNode,
  resetCompositeCounters,
  type CompositeSchema,
  type CompositeTemplateId,
  type LabHub,
} from '@/components/editor/composite/composite-schema';
import { getMaterial } from '@/components/editor/material/material-registry';
import { staticCatalog, type EntrySpec, type LibraryEntry, type LibrarySection } from './library-catalog';

export type LibraryViewMode = 'galaxy' | 'canvas';

// ── canvas instances (a discriminated union — one Inspector branches by kind) ─────
export type LibraryInstance =
  | { id: string; kind: 'primitive'; schema: PrimitiveSchema }
  | { id: string; kind: 'fluid'; schema: FluidSchema }
  | { id: string; kind: 'composite'; schema: CompositeSchema };

export interface SavedTemplate {
  savedId: string;
  label: string;
  /** a deep snapshot of one canvas instance, re-minted fresh on instantiate. */
  snapshot: LibraryInstance;
}

// A tiny sample hub set so the bound NAV HEADER composite (P-4) can resolve tabs.
const LIBRARY_HUBS: LabHub[] = [
  { hubId: 'lib-hub-home', title: 'Home', caption: 'Landing' },
  { hubId: 'lib-hub-work', title: 'Work', caption: 'Gallery' },
  { hubId: 'lib-hub-about', title: 'About', caption: 'Studio' },
];

// The dogfooded NODE-EDITOR chrome panel is itself a real Pane primitive NODE
// (spec §7.4 — the glass pane in the chrome IS the same Pane primitive a customer
// places). It is registered on boot with this fixed id so the authorship gate counts
// the chrome as node-authored.
export const CHROME_PANE_ID = 'lib-chrome-pane';

export interface LibraryStore {
  // ── browse UI state ──
  section: LibrarySection;
  family: string; // active materials sub-group
  query: string;
  searchFocused: boolean;
  viewMode: LibraryViewMode;

  // ── canvas state (Node Law) ──
  instances: LibraryInstance[];
  selectedId: string | null;
  savedTemplates: SavedTemplate[];
  /** the entry currently being dragged from the palette (null = none). */
  dragEntryId: string | null;
  /** the world point where the drag began (the tile), for tap-vs-drag distance. */
  dragStart: { x: number; y: number; z: number } | null;
  /** monotonic — bump on any mutation so non-reactive consumers re-read. */
  rev: number;

  readonly hubs: LabHub[];

  // ── browse actions ──
  setSection: (s: LibrarySection) => void;
  setFamily: (f: string) => void;
  setQuery: (q: string) => void;
  focusSearch: (on: boolean) => void;
  typeSearch: (ch: string) => void;
  backspaceSearch: () => void;
  setView: (m: LibraryViewMode) => void;
  beginDrag: (entryId: string, start?: { x: number; y: number; z: number }) => void;
  endDrag: () => void;

  // ── instantiation (Node Law, §5) ──
  /** create the backing node(s) for an entry at a drop position; returns instance id. */
  instantiate: (entry: LibraryEntry, pos?: { x: number; y: number; z?: number }) => string;
  remove: (id: string) => void;
  clear: () => void;
  saveSelectedAsTemplate: () => string | null;

  // ── selection ──
  select: (id: string | null) => void;

  // ── live schema edits (§5.3) ──
  updatePrimParam: (id: string, patch: Partial<PrimitiveParams>) => void;
  updatePrimMaterial: (id: string, patch: Partial<PrimitiveMaterial>) => void;
  applyMaterial: (id: string, materialId: string) => void;
  updateFluidParam: (id: string, patch: Partial<FluidParams>) => void;
  moveInstance: (id: string, pos: { x: number; y: number }) => void;

  // ── reads ──
  catalog: () => LibraryEntry[];
  getInstance: (id: string) => LibraryInstance | undefined;
  /** NODE LAW: every instance projected to real PrismNode(s). */
  nodes: () => PrismNode[];
}

function instanceRoot(i: LibraryInstance): { x: number; y: number; z: number } {
  if (i.kind === 'composite') return { ...i.schema.root };
  return { x: i.schema.transform.x, y: i.schema.transform.y, z: i.schema.transform.z };
}

// Project one instance to its backing PrismNode(s).
function instanceNodes(i: LibraryInstance, hubs: LabHub[]): PrismNode[] {
  if (i.kind === 'primitive') return [primToNode(i.schema)];
  if (i.kind === 'fluid') return [fluidToNode(i.schema)];
  // composite → one node per member, world-rooted at the composite root.
  return compositeMembers(i.schema, hubs).map((m) => memberToNode(m, i.schema, i.schema.root));
}

// Deterministic non-overlapping fallback drop slots (center canvas band; the right
// side x ≳ 6 is reserved for the docked Inspector, the left x ≲ -6 for the palette).
const DROP_X = [-1.4, 1.8, -3.8, 3.6, 0.2, -2.2];
const DROP_Y = [1.4, -1.0, 3.0];
function dropSlot(index: number): { x: number; y: number } {
  return { x: DROP_X[index % DROP_X.length], y: DROP_Y[Math.floor(index / DROP_X.length) % DROP_Y.length] };
}

// Build a fresh instance for an entry spec at a world position.
function buildInstance(spec: EntrySpec, hubs: LabHub[], saved: SavedTemplate[], pos: { x: number; y: number; z?: number }): LibraryInstance | null {
  switch (spec.t) {
    case 'primitive': {
      const schema = makePrimSchema(spec.kind, { transform: { x: pos.x, y: pos.y, z: pos.z ?? 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 } });
      return { id: schema.nodeId, kind: 'primitive', schema };
    }
    case 'material': {
      // a "material display" — a sphere wearing the chosen registry material by id.
      const def = getMaterial(spec.materialId);
      const schema = makePrimSchema('sphere', {
        caption: def ? def.label : 'Material',
        material: { kind: 'worn-bronze', materialId: spec.materialId, tint: '#ffffff', contrast: 1 },
        transform: { x: pos.x, y: pos.y, z: pos.z ?? 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 },
      });
      return { id: schema.nodeId, kind: 'primitive', schema };
    }
    case 'fluid': {
      const schema = makeFluidSchema(spec.kind, { transform: { x: pos.x, y: pos.y, z: pos.z ?? 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 } });
      return { id: schema.nodeId, kind: 'fluid', schema };
    }
    case 'composite': {
      const schema = makeComposite(spec.templateId, hubs, { root: { x: pos.x, y: pos.y, z: pos.z ?? 0 } });
      return { id: schema.compositeId, kind: 'composite', schema };
    }
    case 'saved': {
      const tpl = saved.find((s) => s.savedId === spec.savedId);
      if (!tpl) return null;
      return cloneInstance(tpl.snapshot, hubs, pos);
    }
  }
}

// Deep-clone a snapshot instance with FRESH ids at a new position (§6.4 re-instantiate).
function cloneInstance(src: LibraryInstance, hubs: LabHub[], pos: { x: number; y: number; z?: number }): LibraryInstance {
  if (src.kind === 'primitive') {
    const schema = makePrimSchema(src.schema.kind, {
      caption: src.schema.caption,
      params: { ...src.schema.params, cutouts: src.schema.params.cutouts.map((c) => ({ ...c })) },
      material: { ...src.schema.material },
      transform: { ...src.schema.transform, x: pos.x, y: pos.y, z: pos.z ?? src.schema.transform.z },
    });
    return { id: schema.nodeId, kind: 'primitive', schema };
  }
  if (src.kind === 'fluid') {
    const schema = makeFluidSchema(src.schema.kind, {
      caption: src.schema.caption,
      width: src.schema.width,
      height: src.schema.height,
      params: { ...src.schema.params },
      transform: { ...src.schema.transform, x: pos.x, y: pos.y, z: pos.z ?? src.schema.transform.z },
    });
    return { id: schema.nodeId, kind: 'fluid', schema };
  }
  const schema = makeComposite(src.schema.templateId, hubs, {
    caption: src.schema.caption,
    root: { x: pos.x, y: pos.y, z: pos.z ?? src.schema.root.z },
    staticMembers: src.schema.staticMembers.map((m) => ({ ...m, local: { ...m.local } })),
    binding: src.schema.binding ? { ...src.schema.binding } : undefined,
  });
  // re-mint the captured members' ids onto the fresh composite so node ids stay unique.
  schema.staticMembers = schema.staticMembers.map((m, i) => ({ ...m, memberId: `${schema.compositeId}-m${i}` }));
  return { id: schema.compositeId, kind: 'composite', schema };
}

function patchPrim(insts: LibraryInstance[], id: string, fn: (s: PrimitiveSchema) => PrimitiveSchema): LibraryInstance[] {
  return insts.map((i) => (i.id === id && i.kind === 'primitive' ? { ...i, schema: fn(i.schema) } : i));
}
function patchFluid(insts: LibraryInstance[], id: string, fn: (s: FluidSchema) => FluidSchema): LibraryInstance[] {
  return insts.map((i) => (i.id === id && i.kind === 'fluid' ? { ...i, schema: fn(i.schema) } : i));
}

let savedSeq = 0;

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  section: 'primitives',
  family: 'Metals',
  query: '',
  searchFocused: false,
  viewMode: 'canvas',

  instances: [],
  selectedId: null,
  savedTemplates: [],
  dragEntryId: null,
  dragStart: null,
  rev: 0,
  hubs: LIBRARY_HUBS,

  setSection: (s) => set({ section: s, rev: get().rev + 1 }),
  setFamily: (f) => set({ family: f, rev: get().rev + 1 }),
  setQuery: (q) => set({ query: q, rev: get().rev + 1 }),
  focusSearch: (on) => set({ searchFocused: on }),
  typeSearch: (ch) => set((st) => ({ query: (st.query + ch).slice(0, 32), rev: st.rev + 1 })),
  backspaceSearch: () => set((st) => ({ query: st.query.slice(0, -1), rev: st.rev + 1 })),
  setView: (m) => set({ viewMode: m }),
  beginDrag: (entryId, start) => set({ dragEntryId: entryId, dragStart: start ?? null }),
  endDrag: () => set({ dragEntryId: null, dragStart: null }),

  instantiate: (entry, pos) => {
    const st = get();
    const at = pos ?? dropSlot(st.instances.filter((i) => i.id !== CHROME_PANE_ID).length);
    const inst = buildInstance(entry.spec, st.hubs, st.savedTemplates, at);
    if (!inst) return '';
    set((s) => ({ instances: [...s.instances, inst], selectedId: inst.id, dragEntryId: null, dragStart: null, rev: s.rev + 1 }));
    return inst.id;
  },
  remove: (id) =>
    set((s) => ({
      instances: s.instances.filter((i) => i.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      rev: s.rev + 1,
    })),
  clear: () => {
    resetPrimCounters();
    resetFluidCounters();
    resetCompositeCounters();
    savedSeq = 0;
    set({ instances: [], selectedId: null, savedTemplates: [], rev: 0 });
  },
  saveSelectedAsTemplate: () => {
    const st = get();
    const inst = st.instances.find((i) => i.id === st.selectedId);
    if (!inst || inst.id === CHROME_PANE_ID) return null;
    savedSeq += 1;
    const savedId = `saved:user:${savedSeq}`;
    const label =
      inst.kind === 'composite' ? inst.schema.caption : inst.kind === 'fluid' ? inst.schema.caption : inst.schema.caption;
    const snapshot = JSON.parse(JSON.stringify(inst)) as LibraryInstance;
    set((s) => ({ savedTemplates: [...s.savedTemplates, { savedId, label, snapshot }], rev: s.rev + 1 }));
    return savedId;
  },

  select: (id) => set({ selectedId: id }),

  updatePrimParam: (id, patch) =>
    set((s) => ({ instances: patchPrim(s.instances, id, (sc) => ({ ...sc, params: { ...sc.params, ...patch } })), rev: s.rev + 1 })),
  updatePrimMaterial: (id, patch) =>
    set((s) => ({ instances: patchPrim(s.instances, id, (sc) => ({ ...sc, material: { ...sc.material, ...patch } })), rev: s.rev + 1 })),
  applyMaterial: (id, materialId) =>
    set((s) => ({
      instances: patchPrim(s.instances, id, (sc) => ({ ...sc, material: { ...sc.material, materialId } })),
      rev: s.rev + 1,
    })),
  updateFluidParam: (id, patch) =>
    set((s) => ({ instances: patchFluid(s.instances, id, (sc) => ({ ...sc, params: { ...sc.params, ...patch } })), rev: s.rev + 1 })),
  moveInstance: (id, pos) =>
    set((s) => ({
      instances: s.instances.map((i) => {
        if (i.id !== id) return i;
        if (i.kind === 'composite') return { ...i, schema: { ...i.schema, root: { ...i.schema.root, x: pos.x, y: pos.y } } };
        return { ...i, schema: { ...i.schema, transform: { ...i.schema.transform, x: pos.x, y: pos.y } } as PrimitiveSchema & FluidSchema } as LibraryInstance;
      }),
      rev: s.rev + 1,
    })),

  catalog: () => {
    const saved = get().savedTemplates.map<LibraryEntry>((t) => ({
      id: t.savedId,
      section: 'saved',
      group: 'My Library',
      label: t.label,
      spec: { t: 'saved', savedId: t.savedId },
    }));
    return [...staticCatalog(), ...saved];
  },
  getInstance: (id) => get().instances.find((i) => i.id === id),
  nodes: () => {
    const st = get();
    return st.instances.flatMap((i) => instanceNodes(i, st.hubs));
  },
}));

export { instanceRoot, instanceNodes };

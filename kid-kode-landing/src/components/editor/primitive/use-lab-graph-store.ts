'use client';

// PRISM PRIMITIVE LAB — the live graph store (spec §0 NODE LAW + §5 instantiation).
//
// The PrimitiveSchema array is the SINGLE SOURCE OF TRUTH; every schema maps to a
// real PrismNode (schemaToNode). `instantiate(kind)` creates the node AND it is
// rendered from this same store in the same action — one cannot exist without the
// other (INV-0.1..0.3). Galaxy = nodes shown UNBUILT (dormant spheres); Canvas =
// nodes REALIZED (the parametric 3D artifacts). Editing a primitive writes to its
// schema here (single source of truth, INV-0.2 / §5.3); the renderer re-reads.

import { create } from 'zustand';
import type { PrismNode } from '@/lib/prism-graph/types';
import { mintCutoutId } from './primitive-geometry';
import {
  makeSchema,
  resetMintCounters,
  schemaToNode,
  type Cutout,
  type MaterialKind,
  type PrimitiveKind,
  type PrimitiveMaterial,
  type PrimitiveParams,
  type PrimitiveSchema,
  type PrimitiveTransform,
} from './primitive-schema';

export type LabViewMode = 'galaxy' | 'canvas';

// Deterministic placement slots so instantiated primitives don't overlap, kept
// clear of the top mode-toggle tab and the bottom instantiate palette.
const SLOTS_X = [-0.6, 3.0, -3.6, -6.4, 5.6, -9.0, 8.2];
const ROW_Y = [0.3, -1.7];
function slotFor(index: number): { x: number; y: number } {
  const col = index % SLOTS_X.length;
  const row = Math.floor(index / SLOTS_X.length) % ROW_Y.length;
  return { x: SLOTS_X[col], y: ROW_Y[row] };
}

export interface LabGraphStore {
  schemas: PrimitiveSchema[];
  selectedId: string | null;
  viewMode: LabViewMode;
  /** monotonic — bump on any mutation so consumers re-read. */
  rev: number;

  // ── instantiation (Node Law) ──
  instantiate: (kind: PrimitiveKind) => string;
  remove: (nodeId: string) => void;
  clear: () => void;

  // ── selection + view ──
  select: (nodeId: string | null) => void;
  setView: (mode: LabViewMode) => void;

  // ── live schema edits (§5.3) ──
  updateParam: (nodeId: string, patch: Partial<PrimitiveParams>) => void;
  updateMaterial: (nodeId: string, patch: Partial<PrimitiveMaterial>) => void;
  setMaterialKind: (nodeId: string, kind: MaterialKind) => void;
  updateTransform: (nodeId: string, patch: Partial<PrimitiveTransform>) => void;
  addCutout: (nodeId: string) => void;
  updateCutout: (nodeId: string, cutoutId: string, patch: Partial<Cutout>) => void;
  removeCutout: (nodeId: string, cutoutId: string) => void;

  // ── reads ──
  getSchema: (nodeId: string) => PrimitiveSchema | undefined;
  /** NODE LAW: every schema as a real PrismNode (derived source of truth). */
  nodes: () => PrismNode[];
}

function patchSchema(
  schemas: PrimitiveSchema[],
  nodeId: string,
  fn: (s: PrimitiveSchema) => PrimitiveSchema,
): PrimitiveSchema[] {
  return schemas.map((s) => (s.nodeId === nodeId ? fn(s) : s));
}

export const useLabGraphStore = create<LabGraphStore>((set, get) => ({
  schemas: [],
  selectedId: null,
  viewMode: 'canvas',
  rev: 0,

  instantiate: (kind) => {
    const index = get().schemas.length;
    const slot = slotFor(index);
    const schema = makeSchema(kind, { transform: { x: slot.x, y: slot.y, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 } });
    set((st) => ({ schemas: [...st.schemas, schema], selectedId: schema.nodeId, rev: st.rev + 1 }));
    return schema.nodeId;
  },
  remove: (nodeId) =>
    set((st) => ({
      schemas: st.schemas.filter((s) => s.nodeId !== nodeId),
      selectedId: st.selectedId === nodeId ? null : st.selectedId,
      rev: st.rev + 1,
    })),
  clear: () => {
    resetMintCounters();
    set({ schemas: [], selectedId: null, rev: 0 });
  },

  select: (nodeId) => set({ selectedId: nodeId }),
  setView: (mode) => set({ viewMode: mode }),

  updateParam: (nodeId, patch) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => ({ ...s, params: { ...s.params, ...patch } })),
      rev: st.rev + 1,
    })),
  updateMaterial: (nodeId, patch) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => ({ ...s, material: { ...s.material, ...patch } })),
      rev: st.rev + 1,
    })),
  setMaterialKind: (nodeId, kind) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => ({ ...s, material: { ...s.material, kind } })),
      rev: st.rev + 1,
    })),
  updateTransform: (nodeId, patch) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => ({ ...s, transform: { ...s.transform, ...patch } })),
      rev: st.rev + 1,
    })),
  addCutout: (nodeId) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => {
        if (s.kind !== 'pane') return s;
        const cut: Cutout = { id: mintCutoutId(), x: 0, y: 0, w: 0.7, h: 0.7, r: 0.14 };
        return { ...s, params: { ...s.params, cutouts: [...s.params.cutouts, cut] } };
      }),
      rev: st.rev + 1,
    })),
  updateCutout: (nodeId, cutoutId, patch) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => ({
        ...s,
        params: {
          ...s.params,
          cutouts: s.params.cutouts.map((c) => (c.id === cutoutId ? { ...c, ...patch } : c)),
        },
      })),
      rev: st.rev + 1,
    })),
  removeCutout: (nodeId, cutoutId) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => ({
        ...s,
        params: { ...s.params, cutouts: s.params.cutouts.filter((c) => c.id !== cutoutId) },
      })),
      rev: st.rev + 1,
    })),

  getSchema: (nodeId) => get().schemas.find((s) => s.nodeId === nodeId),
  nodes: () => get().schemas.map(schemaToNode),
}));

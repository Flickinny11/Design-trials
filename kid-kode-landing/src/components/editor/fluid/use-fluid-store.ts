'use client';

// PRISM FLUID LAB — the live graph store (spec §0 NODE LAW + §5 instantiation).
//
// The FluidSchema array is the SINGLE SOURCE OF TRUTH; every schema maps to a real
// PrismNode (schemaToNode). `instantiate(kind)` creates the node AND it is rendered
// from this same store in the same action — one cannot exist without the other
// (INV-0.1..0.3). Galaxy = nodes shown UNBUILT (dormant spheres); Canvas = nodes
// REALIZED (the live GPU-simulated fluids). Editing a fluid writes to its params
// here (single source of truth, INV-0.2 / §5.3); the sim + material re-read.
//
// Plus the LIQUID-GLASS expand TIMELINE (spec §3.3): `liquidGlassPhase` 0..1 drives
// the "any glass element can go liquid" reveal — the P-4 nav-dropdown expansion.

import { create } from 'zustand';
import type { PrismNode } from '@/lib/prism-graph/types';
import {
  makeSchema,
  resetMintCounters,
  schemaToNode,
  slotFor,
  type FluidKind,
  type FluidParams,
  type FluidSchema,
  type FluidTransform,
} from './fluid-schema';

export type FluidViewMode = 'galaxy' | 'canvas';

export interface FluidStore {
  schemas: FluidSchema[];
  selectedId: string | null;
  viewMode: FluidViewMode;
  /** monotonic — bump on any mutation so consumers re-read. */
  rev: number;

  // ── liquid-glass expand timeline (spec §3.3) ──
  /** 0 = solid glass slab · 1 = fully liquefied (flowing + warped). */
  liquidGlassPhase: number;
  /** when true, the FluidSurface auto-advances liquidGlassPhase toward its target. */
  liquidGlassPlaying: boolean;

  // ── instantiation (Node Law) ──
  instantiate: (kind: FluidKind) => string;
  remove: (nodeId: string) => void;
  clear: () => void;

  // ── selection + view ──
  select: (nodeId: string | null) => void;
  setView: (mode: FluidViewMode) => void;

  // ── live schema edits (§5.3) ──
  updateParam: (nodeId: string, patch: Partial<FluidParams>) => void;
  updateTransform: (nodeId: string, patch: Partial<FluidTransform>) => void;

  // ── liquid-glass timeline controls ──
  triggerLiquidGlass: () => void;
  setLiquidGlassPhase: (phase: number) => void;
  setLiquidGlassPlaying: (playing: boolean) => void;

  // ── reads ──
  getSchema: (nodeId: string) => FluidSchema | undefined;
  /** NODE LAW: every schema as a real PrismNode (derived source of truth). */
  nodes: () => PrismNode[];
}

function patchSchema(
  schemas: FluidSchema[],
  nodeId: string,
  fn: (s: FluidSchema) => FluidSchema,
): FluidSchema[] {
  return schemas.map((s) => (s.nodeId === nodeId ? fn(s) : s));
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const useFluidStore = create<FluidStore>((set, get) => ({
  schemas: [],
  selectedId: null,
  viewMode: 'canvas',
  rev: 0,
  liquidGlassPhase: 1,
  liquidGlassPlaying: false,

  instantiate: (kind) => {
    const index = get().schemas.length;
    const slot = slotFor(index);
    const schema = makeSchema(kind, {
      transform: { x: slot.x, y: slot.y, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 },
    });
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
  updateTransform: (nodeId, patch) =>
    set((st) => ({
      schemas: patchSchema(st.schemas, nodeId, (s) => ({ ...s, transform: { ...s.transform, ...patch } })),
      rev: st.rev + 1,
    })),

  triggerLiquidGlass: () =>
    set((st) => ({
      // toggle: if mostly liquid, re-solidify then re-flow; else liquefy.
      liquidGlassPhase: st.liquidGlassPhase > 0.5 ? 0 : st.liquidGlassPhase,
      liquidGlassPlaying: true,
      rev: st.rev + 1,
    })),
  setLiquidGlassPhase: (phase) => set({ liquidGlassPhase: clamp01(phase) }),
  setLiquidGlassPlaying: (playing) => set({ liquidGlassPlaying: playing }),

  getSchema: (nodeId) => get().schemas.find((s) => s.nodeId === nodeId),
  nodes: () => get().schemas.map(schemaToNode),
}));

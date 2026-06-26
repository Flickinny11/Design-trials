'use client';

// /material-lab store — the MATERIAL review surface (spec §2 / §7).
//
// Three DISPLAY primitives (pane / cube / sphere) are real backing NODES (Node Law,
// INV-0.1) so a material can be judged on flat, boxed, and round geometry at once.
// The library is browsed by family; picking a swatch APPLIES that material id to all
// three displays live (§2.5). Per-instance PBR overrides (W-APPLY Inspector) tune
// the applied material. This store is the material-lab's own — isolated from the
// /primitive-lab graph store — with its own Node-Law probe (`__PRISM_MAT_*`).

import { create } from 'zustand';
import type { PrismNode } from '@/lib/prism-graph/types';
import {
  makeSchema,
  schemaToNode,
  type PrimitiveKind,
  type PrimitiveSchema,
} from '@/components/editor/primitive/primitive-schema';
import type { MaterialFamily, MaterialParams } from './material-types';

export type OverrideMap = Record<string, number | string | [number, number]>;

const DISPLAY_KINDS: PrimitiveKind[] = ['pane', 'cube', 'sphere'];
// Stage slots for the three display primitives (upper band, read left→right).
const DISPLAY_SLOTS: Record<PrimitiveKind, { x: number; y: number; scale: number }> = {
  pane: { x: -3.7, y: 2.9, scale: 0.92 },
  cube: { x: 0, y: 2.9, scale: 1.0 },
  sphere: { x: 3.7, y: 2.9, scale: 1.0 },
};

const DEFAULT_MATERIAL = 'metal.worn-sapphire'; // opens matching the approved look

export interface MaterialStore {
  displays: PrimitiveSchema[];
  selectedDisplayId: string | null;
  selectedMaterialId: string;
  activeFamily: MaterialFamily;
  /** per-instance overrides applied to the current material on all displays. */
  overrides: OverrideMap;
  rev: number;

  // ── prompt-to-texture UI state (W-PROMPT; orchestration lives in the panel) ──
  promptBuffer: string;
  promptFocused: boolean;
  /** idle | generating | done | error */
  genStatus: 'idle' | 'generating' | 'done' | 'error';
  genMessage: string;

  setMaterial: (id: string) => void;
  setActiveFamily: (family: MaterialFamily) => void;
  selectDisplay: (id: string | null) => void;
  updateOverride: (patch: OverrideMap) => void;
  resetOverrides: () => void;

  setPromptBuffer: (s: string) => void;
  setPromptFocused: (f: boolean) => void;
  setGenStatus: (status: MaterialStore['genStatus'], message?: string) => void;

  nodes: () => PrismNode[];
}

function seedDisplays(): PrimitiveSchema[] {
  return DISPLAY_KINDS.map((kind) => {
    const slot = DISPLAY_SLOTS[kind];
    const s = makeSchema(kind, {
      transform: { x: slot.x, y: slot.y, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: slot.scale },
    });
    s.material.materialId = DEFAULT_MATERIAL;
    s.material.overrides = {};
    return s;
  });
}

export const useMaterialStore = create<MaterialStore>((set, get) => ({
  displays: seedDisplays(),
  selectedDisplayId: null,
  selectedMaterialId: DEFAULT_MATERIAL,
  activeFamily: 'Metals',
  overrides: {},
  rev: 0,

  promptBuffer: '',
  promptFocused: false,
  genStatus: 'idle',
  genMessage: '',

  setPromptBuffer: (s) => set({ promptBuffer: s.slice(0, 80) }),
  setPromptFocused: (f) => set({ promptFocused: f }),
  setGenStatus: (status, message = '') => set({ genStatus: status, genMessage: message }),

  setMaterial: (id) =>
    set((st) => ({
      selectedMaterialId: id,
      overrides: {},
      displays: st.displays.map((d) => ({ ...d, material: { ...d.material, materialId: id, overrides: {} } })),
      rev: st.rev + 1,
    })),

  setActiveFamily: (family) => set({ activeFamily: family }),
  selectDisplay: (id) => set({ selectedDisplayId: id }),

  updateOverride: (patch) =>
    set((st) => {
      const overrides = { ...st.overrides, ...patch };
      return {
        overrides,
        displays: st.displays.map((d) => ({ ...d, material: { ...d.material, overrides } })),
        rev: st.rev + 1,
      };
    }),

  resetOverrides: () =>
    set((st) => ({
      overrides: {},
      displays: st.displays.map((d) => ({ ...d, material: { ...d.material, overrides: {} } })),
      rev: st.rev + 1,
    })),

  nodes: () => get().displays.map(schemaToNode),
}));

// Typed override read helper (Inspector faders).
export function overrideValue(
  overrides: OverrideMap,
  key: keyof MaterialParams,
): number | string | [number, number] | undefined {
  return overrides[key as string];
}

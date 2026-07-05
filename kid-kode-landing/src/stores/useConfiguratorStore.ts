// ORRERY No.7 — Atelier configurator store (F5.1).
// Holds the current watch build (per-layer variant), the active catalog layer,
// and the last constraint message. The in-3D catalog fires `configure` /
// `configure-layer` functionBindings into this store (via GraphScene's preview
// click handler); AtelierApplier subscribes and swaps the proxy parts' live
// materials. Serialize() is the save/share/buy payload (spec §3.5).
import { create } from 'zustand';
import {
  DEFAULT_BUILD,
  constraintReason,
  invalidSelections,
  LAYERS_BY_ID,
  type AtelierBuild,
  type AtelierLayerId,
} from '@/lib/prism/atelier/config';

interface ConfiguratorState {
  build: AtelierBuild;
  activeLayer: AtelierLayerId;
  lastReason: string | null;       // constraint feedback for the active interaction
  rev: number;                     // bumps on every accepted change (applier dep key)
  setLayer: (layer: AtelierLayerId, variant: string) => void;
  setActiveLayer: (layer: AtelierLayerId) => void;
  reset: () => void;
  serialize: () => string;
  restore: (json: string) => boolean;
}

export const useConfiguratorStore = create<ConfiguratorState>((set, get) => ({
  build: { ...DEFAULT_BUILD },
  activeLayer: 'case',
  lastReason: null,
  rev: 0,
  setLayer: (layer, variant) => {
    const cur = get().build;
    if (!LAYERS_BY_ID[layer]?.variants.some((v) => v.id === variant)) return;
    // is THIS selection legal against the current build?
    const reason = constraintReason(layer, variant, { ...cur, [layer]: variant });
    if (reason) {
      set({ lastReason: reason });
      return;
    }
    const next = { ...cur, [layer]: variant };
    // a gating change (e.g. movement) may invalidate downstream picks → reset them
    for (const bad of invalidSelections(next)) {
      next[bad] = LAYERS_BY_ID[bad].defaultVariant;
    }
    set((s) => ({ build: next, lastReason: null, rev: s.rev + 1 }));
  },
  setActiveLayer: (layer) => set({ activeLayer: layer, lastReason: null }),
  reset: () => set((s) => ({ build: { ...DEFAULT_BUILD }, lastReason: null, rev: s.rev + 1 })),
  serialize: () => JSON.stringify({ v: 1, build: get().build }),
  restore: (json) => {
    try {
      const parsed = JSON.parse(json) as { v?: number; build?: Partial<AtelierBuild> };
      if (!parsed || typeof parsed.build !== 'object') return false;
      const next = { ...DEFAULT_BUILD, ...parsed.build } as AtelierBuild;
      set((s) => ({ build: next, lastReason: null, rev: s.rev + 1 }));
      return true;
    } catch {
      return false;
    }
  },
}));

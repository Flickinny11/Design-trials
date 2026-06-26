'use client';

// PRISM COMPOSITE LAB — the live graph store (spec §0 NODE LAW + §4 + §5).
//
// SINGLE SOURCE OF TRUTH: the hub set + the composite schemas. Every hub and every
// composite member maps to a real PrismNode (hubToNode / memberToNode). The bound
// nav tabs + dropdown menu items are DERIVED LIVE from (hubs ⊕ binding) — so
// `nodes()` and `edges()` recompute the full subgraph on every read, and adding a
// hub (with auto-add ON) immediately yields one more backing tab NODE (auto-populate
// with zero manual reconcile; INV-0.4).
//
// `instantiateComposite(t)` registers the WHOLE subgraph (all member nodes + edges)
// in one action (spec §5.2 / INV-0.4). Galaxy = nodes shown UNBUILT (dormant seeds);
// Canvas = nodes REALIZED (the assembled 3D composite). Editing the binding writes
// here (single source of truth, INV-0.2 / §5.3); the renderer re-reads.

import { create } from 'zustand';
import type { PrismNode } from '@/lib/prism-graph/types';
import {
  type CompositeEdge,
  type CompositeSchema,
  type CompositeTemplateId,
  type LabHub,
  type NavBinding,
  type NavTab,
  compositeEdges,
  compositeMembers,
  hubToNode,
  makeComposite,
  memberToNode,
  resetCompositeCounters,
  resolveNavTabs,
} from './composite-schema';

export type CompositeViewMode = 'galaxy' | 'canvas';

// The lab's sample multi-hub graph — the "app's pages" the nav binds to (§4 review
// requirement: the nav composite over a small multi-hub sample graph). Deterministic.
const SEED_HUBS: LabHub[] = [
  { hubId: 'page-home', title: 'Home', caption: 'The landing — hero, headline, the first beat.' },
  { hubId: 'page-work', title: 'Work', caption: 'Selected projects and case studies.' },
  { hubId: 'page-studio', title: 'Studio', caption: 'Who we are and how we build.' },
  { hubId: 'page-journal', title: 'Journal', caption: 'Notes, experiments, release log.' },
  { hubId: 'page-contact', title: 'Contact', caption: 'Start a conversation.' },
];

let hubSeq = 0;
function mintHubId(): string {
  hubSeq += 1;
  return `page-new-${hubSeq}`;
}
const NEW_HUB_TITLES = ['Pricing', 'Docs', 'Careers', 'Press', 'Support', 'Blog', 'Gallery', 'Roadmap'];

export interface CompositeStore {
  hubs: LabHub[];
  composites: CompositeSchema[];
  selectedId: string | null; // a compositeId
  viewMode: CompositeViewMode;
  rev: number;

  // ── liquid-glass dropdown expand timeline (spec §3.3 / §4) ──
  expandedCompositeId: string | null;
  dropdownPhase: number; // 0 = closed solid slab · 1 = fully expanded flowing liquid
  dropdownTarget: 0 | 1; // where the timeline is heading
  dropdownPlaying: boolean;

  // ── instantiation (Node Law, §5.2) ──
  instantiateComposite: (templateId: CompositeTemplateId) => string;
  removeComposite: (compositeId: string) => void;
  clear: () => void;

  // ── selection + view ──
  select: (compositeId: string | null) => void;
  setView: (mode: CompositeViewMode) => void;

  // ── hub-set edits (drive the binding demo) ──
  addHub: (hub?: Partial<LabHub>) => string;
  removeHub: (hubId: string) => void;

  // ── nav binding edits (§4.2.2) ──
  toggleAutoAdd: (compositeId: string) => void;
  renameTab: (compositeId: string, hubId: string, label: string) => void;
  hideHub: (compositeId: string, hubId: string) => void;
  showHub: (compositeId: string, hubId: string) => void;
  reorderTab: (compositeId: string, key: string, dir: -1 | 1) => void;
  addManualItem: (compositeId: string, label?: string) => void;
  removeManualItem: (compositeId: string, id: string) => void;

  // ── dropdown timeline ──
  toggleDropdown: (compositeId: string) => void;
  setDropdownPhase: (phase: number) => void;
  setDropdownPlaying: (playing: boolean) => void;

  // ── reads ──
  getComposite: (compositeId: string) => CompositeSchema | undefined;
  navTabs: (compositeId: string) => NavTab[];
  /** NODE LAW: hubs + every composite member as a real PrismNode. */
  nodes: () => PrismNode[];
  /** the subgraph edges (parent stacking + hub bindings). */
  edges: () => CompositeEdge[];
}

function patchComposite(
  composites: CompositeSchema[],
  compositeId: string,
  fn: (c: CompositeSchema) => CompositeSchema,
): CompositeSchema[] {
  return composites.map((c) => (c.compositeId === compositeId ? fn(c) : c));
}
function patchBinding(c: CompositeSchema, fn: (b: NavBinding) => NavBinding): CompositeSchema {
  if (!c.binding) return c;
  return { ...c, binding: fn(c.binding) };
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

let manualSeq = 0;

export const useCompositeStore = create<CompositeStore>((set, get) => ({
  hubs: SEED_HUBS,
  composites: [],
  selectedId: null,
  viewMode: 'canvas',
  rev: 0,
  expandedCompositeId: null,
  dropdownPhase: 0,
  dropdownTarget: 0,
  dropdownPlaying: false,

  instantiateComposite: (templateId) => {
    const composite = makeComposite(templateId, get().hubs, {
      root: rootSlotFor(get().composites.length, templateId),
    });
    set((st) => ({ composites: [...st.composites, composite], selectedId: composite.compositeId, rev: st.rev + 1 }));
    return composite.compositeId;
  },
  removeComposite: (compositeId) =>
    set((st) => ({
      composites: st.composites.filter((c) => c.compositeId !== compositeId),
      selectedId: st.selectedId === compositeId ? null : st.selectedId,
      expandedCompositeId: st.expandedCompositeId === compositeId ? null : st.expandedCompositeId,
      rev: st.rev + 1,
    })),
  clear: () => {
    resetCompositeCounters();
    set({ hubs: SEED_HUBS, composites: [], selectedId: null, expandedCompositeId: null, dropdownPhase: 0, rev: 0 });
  },

  select: (compositeId) => set({ selectedId: compositeId }),
  setView: (mode) => set({ viewMode: mode }),

  // AUTO-ADD: when ON, also fold the new hub into every nav binding's known set +
  // order so it appears (§4.2.3). When a binding has auto-add OFF, we DON'T touch
  // its known set → the new hub stays frozen out of that nav.
  addHub: (hub) => {
    const hubId = hub?.hubId ?? mintHubId();
    const title = hub?.title ?? NEW_HUB_TITLES[(hubSeq - 1) % NEW_HUB_TITLES.length] ?? `Page ${hubSeq}`;
    const newHub: LabHub = { hubId, title, caption: hub?.caption ?? `${title} — a new page.` };
    set((st) => ({
      hubs: [...st.hubs, newHub],
      composites: st.composites.map((c) =>
        c.binding && c.binding.autoAdd
          ? { ...c, binding: { ...c.binding, knownHubIds: [...c.binding.knownHubIds, hubId], order: [...c.binding.order, hubId] } }
          : c,
      ),
      rev: st.rev + 1,
    }));
    return hubId;
  },
  removeHub: (hubId) =>
    set((st) => ({
      hubs: st.hubs.filter((h) => h.hubId !== hubId),
      composites: st.composites.map((c) =>
        c.binding
          ? {
              ...c,
              binding: {
                ...c.binding,
                knownHubIds: c.binding.knownHubIds.filter((id) => id !== hubId),
                order: c.binding.order.filter((k) => k !== hubId),
                hidden: c.binding.hidden.filter((id) => id !== hubId),
              },
            }
          : c,
      ),
      rev: st.rev + 1,
    })),

  // AUTO-ADD toggle: flipping ON re-syncs the known set + order to include every
  // hub that appeared while it was OFF (§4.2.3). Flipping OFF freezes the set.
  toggleAutoAdd: (compositeId) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) =>
        patchBinding(c, (b) => {
          const next = !b.autoAdd;
          if (!next) return { ...b, autoAdd: false };
          const missing = st.hubs.map((h) => h.hubId).filter((id) => !b.knownHubIds.includes(id));
          return { ...b, autoAdd: true, knownHubIds: [...b.knownHubIds, ...missing], order: [...b.order, ...missing] };
        }),
      ),
      rev: st.rev + 1,
    })),
  renameTab: (compositeId, hubId, label) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) =>
        patchBinding(c, (b) => ({ ...b, renames: { ...b.renames, [hubId]: label } })),
      ),
      rev: st.rev + 1,
    })),
  hideHub: (compositeId, hubId) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) =>
        patchBinding(c, (b) => ({ ...b, hidden: b.hidden.includes(hubId) ? b.hidden : [...b.hidden, hubId] })),
      ),
      rev: st.rev + 1,
    })),
  showHub: (compositeId, hubId) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) =>
        patchBinding(c, (b) => ({ ...b, hidden: b.hidden.filter((id) => id !== hubId) })),
      ),
      rev: st.rev + 1,
    })),
  // reorder a tab by one slot in the resolved order (§4.2.2).
  reorderTab: (compositeId, key, dir) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) => {
        if (!c.binding) return c;
        const tabs = resolveNavTabs(st.hubs, c.binding).map((t) => t.key);
        const i = tabs.indexOf(key);
        const j = i + dir;
        if (i === -1 || j < 0 || j >= tabs.length) return c;
        const next = [...tabs];
        [next[i], next[j]] = [next[j], next[i]];
        return patchBinding(c, (b) => ({ ...b, order: next }));
      }),
      rev: st.rev + 1,
    })),
  addManualItem: (compositeId, label) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) =>
        patchBinding(c, (b) => {
          manualSeq += 1;
          const id = `m${manualSeq}`;
          return { ...b, manualItems: [...b.manualItems, { id, label: label ?? 'Sign In' }], order: [...b.order, `manual:${id}`] };
        }),
      ),
      rev: st.rev + 1,
    })),
  removeManualItem: (compositeId, id) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) =>
        patchBinding(c, (b) => ({
          ...b,
          manualItems: b.manualItems.filter((m) => m.id !== id),
          order: b.order.filter((k) => k !== `manual:${id}`),
        })),
      ),
      rev: st.rev + 1,
    })),

  toggleDropdown: (compositeId) =>
    set((st) => {
      // open this composite's dropdown if it's not the one already (mostly) open.
      const alreadyOpen = st.expandedCompositeId === compositeId && st.dropdownPhase > 0.5;
      const target: 0 | 1 = alreadyOpen ? 0 : 1;
      return {
        expandedCompositeId: compositeId,
        dropdownTarget: target,
        dropdownPlaying: true,
        rev: st.rev + 1,
      };
    }),
  setDropdownPhase: (phase) => set({ dropdownPhase: clamp01(phase) }),
  setDropdownPlaying: (playing) => set({ dropdownPlaying: playing }),

  getComposite: (compositeId) => get().composites.find((c) => c.compositeId === compositeId),
  navTabs: (compositeId) => {
    const c = get().composites.find((x) => x.compositeId === compositeId);
    return c?.binding ? resolveNavTabs(get().hubs, c.binding) : [];
  },
  nodes: () => {
    const st = get();
    const hubNodes = st.hubs.map((h, i) => hubToNode(h, i));
    const memberNodes = st.composites.flatMap((c) => compositeMembers(c, st.hubs).map((m) => memberToNode(m, c)));
    return [...hubNodes, ...memberNodes];
  },
  edges: () => {
    const st = get();
    return st.composites.flatMap((c) => compositeEdges(c, st.hubs));
  },
}));

// Deterministic placement so multiple composites don't overlap. Nav sits high,
// footer low, cards in the mid band (left of the docked Inspector at x ≳ 6).
function rootSlotFor(index: number, templateId: CompositeTemplateId): { x: number; y: number; z: number } {
  if (templateId === 'nav-header') return { x: -0.4, y: 3.0, z: 0 };
  if (templateId === 'footer') return { x: -0.4, y: -4.2, z: 0 };
  const cardIndex = index % 3;
  return { x: -3.4 + cardIndex * 3.4, y: -0.4, z: 0 };
}

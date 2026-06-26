'use client';

// PRISM COMPOSITE LAB — the live graph store (spec §0 NODE LAW + §4 + §5 + §6).
//
// SINGLE SOURCE OF TRUTH: the hub set + the composite schemas + the user connections
// + the saved (user-grown) templates. Every hub and every composite member maps to a
// real PrismNode (hubToNode / memberToNode). The bound nav tabs + dropdown menu items
// are DERIVED LIVE from (hubs ⊕ binding) — so `nodes()`/`edges()` recompute the full
// subgraph on every read.
//
// P-5 adds the COMPOSITION layer (spec §6) on top of P-4:
//   • STACK   — parent-child + z-layer (effectiveRoot composes the world transform up
//               the parent chain, so a stacked child MOVES WITH its parent).
//   • CONNECT — user-drawn data/logic edges between member nodes (visible connectors).
//   • SNAP    — moveComposite snaps to grid + alignment and emits guide lines.
//   • GROUP + SAVE-AS-TEMPLATE — multi-select → capture → a new re-instantiable
//               composite template the user grows the library with (§6.4).

import { create } from 'zustand';
import type { PrismNode } from '@/lib/prism-graph/types';
import {
  type CapturedComposite,
  type CompositeConnection,
  type CompositeEdge,
  type CompositeSchema,
  type CompositeTemplateId,
  type ConnectionKind,
  type LabHub,
  type NavBinding,
  type NavTab,
  type SavedConnection,
  type SavedTemplate,
  compositeEdges,
  compositeMembers,
  hubPlanetPos,
  hubToNode,
  makeComposite,
  memberToNode,
  resetCompositeCounters,
  resolveNavTabs,
} from './composite-schema';
import {
  type AlignGuide,
  type Vec3,
  STACK_Z_OFFSET,
  computeSnap,
  effectiveRoot,
  isDescendant,
  nearestStackTarget,
} from './composition';

export type CompositeViewMode = 'galaxy' | 'canvas';
export type CompositeEditorMode = 'select' | 'move' | 'connect';

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

let manualSeq = 0;
let connSeq = 0;
let groupSeq = 0;
let templateSeq = 0;
let createdSeq = 0;

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

  // ── P-5 composition state (spec §6) ──
  editorMode: CompositeEditorMode;
  selectedMemberId: string | null; // member-level selection (for connect picking)
  multiSelect: string[]; // compositeIds (for GROUP + SAVE-AS-TEMPLATE)
  connections: CompositeConnection[]; // user-drawn data/logic edges (§6.2)
  pendingConnectFrom: string | null; // first-picked node in CONNECT mode
  snapEnabled: boolean;
  showGrid: boolean;
  guides: AlignGuide[]; // transient alignment guides during a move (§6.3)
  userTemplates: SavedTemplate[]; // user-grown library entries (§6.4)

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

  // ── P-5 composition ops (§6) ──
  setEditorMode: (mode: CompositeEditorMode) => void;
  selectMember: (memberId: string | null) => void;
  /** drag a composite in WORLD XY → snap (grid + alignment) → set guides (§6.3). */
  moveComposite: (compositeId: string, worldX: number, worldY: number) => void;
  /** end of a move: clear the transient guides. */
  endMove: () => void;
  /** STACK (§6.1): parent `childId` onto `parentId` (or the nearest target if unset),
   *  preserving world position and pushing the child forward a z-layer. */
  stackComposite: (childId: string, parentId?: string) => boolean;
  unstack: (compositeId: string) => void;
  nudgeZLayer: (compositeId: string, dir: -1 | 1) => void;
  toggleSnap: () => void;
  toggleGrid: () => void;
  /** CONNECT (§6.2): pick a node; first pick arms, second pick creates a connection. */
  pickConnectNode: (nodeId: string, kind?: ConnectionKind) => void;
  cancelConnect: () => void;
  removeConnection: (id: string) => void;
  /** GROUP + SAVE-AS-TEMPLATE (§6.4). */
  toggleMultiSelect: (compositeId: string) => void;
  clearMultiSelect: () => void;
  groupSelection: () => string | null;
  saveAsTemplate: (name?: string) => string | null;
  instantiateUserTemplate: (templateId: string) => string[];

  // ── reads ──
  getComposite: (compositeId: string) => CompositeSchema | undefined;
  navTabs: (compositeId: string) => NavTab[];
  worldRootOf: (compositeId: string) => Vec3 | null;
  nodeWorldPos: (nodeId: string) => Vec3 | null;
  /** NODE LAW: hubs + every composite member as a real PrismNode (world-rooted). */
  nodes: () => PrismNode[];
  /** the subgraph edges (parent stacking + hub bindings + cross-composite stack +
   *  user connections). */
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
const byIdMap = (cs: CompositeSchema[]) => new Map(cs.map((c) => [c.compositeId, c]));

// find which composite a member node belongs to (+ the member).
function locateMember(composites: CompositeSchema[], hubs: LabHub[], nodeId: string) {
  for (const c of composites) {
    const m = compositeMembers(c, hubs).find((mm) => mm.memberId === nodeId);
    if (m) return { composite: c, member: m };
  }
  return null;
}

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

  editorMode: 'select',
  selectedMemberId: null,
  multiSelect: [],
  connections: [],
  pendingConnectFrom: null,
  snapEnabled: true,
  showGrid: true,
  guides: [],
  userTemplates: [],

  instantiateComposite: (templateId) => {
    const ordinal = get().composites.filter((c) => c.templateId === templateId).length;
    const composite = makeComposite(templateId, get().hubs, { root: rootSlotFor(ordinal, templateId) });
    set((st) => ({ composites: [...st.composites, composite], selectedId: composite.compositeId, rev: st.rev + 1 }));
    return composite.compositeId;
  },
  removeComposite: (compositeId) =>
    set((st) => {
      const byId = byIdMap(st.composites);
      const removed = byId.get(compositeId);
      const removedMemberIds = removed
        ? new Set(compositeMembers(removed, st.hubs).map((m) => m.memberId))
        : new Set<string>();
      // orphaned children get re-anchored to their current world root (unstacked).
      const composites = st.composites
        .filter((c) => c.compositeId !== compositeId)
        .map((c) => {
          if (c.parentCompositeId === compositeId) {
            const wr = effectiveRoot(c, byId);
            return { ...c, parentCompositeId: null, zLayer: undefined, root: { x: wr.x, y: wr.y, z: wr.z } };
          }
          return c;
        });
      return {
        composites,
        connections: st.connections.filter((cn) => !removedMemberIds.has(cn.fromNodeId) && !removedMemberIds.has(cn.toNodeId)),
        selectedId: st.selectedId === compositeId ? null : st.selectedId,
        multiSelect: st.multiSelect.filter((id) => id !== compositeId),
        expandedCompositeId: st.expandedCompositeId === compositeId ? null : st.expandedCompositeId,
        rev: st.rev + 1,
      };
    }),
  clear: () => {
    resetCompositeCounters();
    set({
      hubs: SEED_HUBS, composites: [], selectedId: null, expandedCompositeId: null, dropdownPhase: 0,
      editorMode: 'select', selectedMemberId: null, multiSelect: [], connections: [], pendingConnectFrom: null,
      guides: [], userTemplates: [], rev: 0,
    });
  },

  select: (compositeId) => set({ selectedId: compositeId, selectedMemberId: null }),
  setView: (mode) => set({ viewMode: mode }),

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
      const alreadyOpen = st.expandedCompositeId === compositeId && st.dropdownPhase > 0.5;
      const target: 0 | 1 = alreadyOpen ? 0 : 1;
      return { expandedCompositeId: compositeId, dropdownTarget: target, dropdownPlaying: true, rev: st.rev + 1 };
    }),
  setDropdownPhase: (phase) => set({ dropdownPhase: clamp01(phase) }),
  setDropdownPlaying: (playing) => set({ dropdownPlaying: playing }),

  // ── P-5 composition ops ────────────────────────────────────────────────────────
  setEditorMode: (mode) =>
    set((st) => ({ editorMode: mode, pendingConnectFrom: mode === 'connect' ? st.pendingConnectFrom : null, guides: [] })),
  selectMember: (memberId) => set({ selectedMemberId: memberId }),

  moveComposite: (compositeId, worldX, worldY) =>
    set((st) => {
      const byId = byIdMap(st.composites);
      const c = byId.get(compositeId);
      if (!c) return {};
      const snap = computeSnap(compositeId, worldX, worldY, st.composites, byId, st.hubs, {
        grid: st.snapEnabled, align: st.snapEnabled,
      });
      // convert the snapped WORLD target to this composite's own root (parent-relative).
      const pr = c.parentCompositeId ? effectiveRoot(byId.get(c.parentCompositeId)!, byId) : { x: 0, y: 0, z: 0 };
      const root = { x: snap.x - pr.x, y: snap.y - pr.y, z: c.root.z };
      return {
        composites: patchComposite(st.composites, compositeId, (cc) => ({ ...cc, root })),
        guides: snap.guides,
        rev: st.rev + 1,
      };
    }),
  endMove: () => set({ guides: [] }),

  stackComposite: (childId, parentId) => {
    let ok = false;
    set((st) => {
      const byId = byIdMap(st.composites);
      const child = byId.get(childId);
      if (!child) return {};
      const parent = parentId ? byId.get(parentId) : nearestStackTarget(childId, st.composites, byId, st.hubs);
      if (!parent || parent.compositeId === childId) return {};
      if (parent.compositeId === child.parentCompositeId) return {};
      if (isDescendant(parent, childId, byId)) return {}; // never stack onto own subtree
      const childWorld = effectiveRoot(child, byId);
      const parentWorld = effectiveRoot(parent, byId);
      const root = {
        x: childWorld.x - parentWorld.x,
        y: childWorld.y - parentWorld.y,
        z: STACK_Z_OFFSET,
      };
      ok = true;
      return {
        composites: patchComposite(st.composites, childId, (cc) => ({
          ...cc,
          parentCompositeId: parent.compositeId,
          zLayer: (parent.zLayer ?? 0) + 1,
          root,
        })),
        rev: st.rev + 1,
      };
    });
    return ok;
  },
  unstack: (compositeId) =>
    set((st) => {
      const byId = byIdMap(st.composites);
      const c = byId.get(compositeId);
      if (!c || !c.parentCompositeId) return {};
      const wr = effectiveRoot(c, byId);
      return {
        composites: patchComposite(st.composites, compositeId, (cc) => ({
          ...cc,
          parentCompositeId: null,
          zLayer: undefined,
          root: { x: wr.x, y: wr.y, z: wr.z },
        })),
        rev: st.rev + 1,
      };
    }),
  nudgeZLayer: (compositeId, dir) =>
    set((st) => ({
      composites: patchComposite(st.composites, compositeId, (c) => ({ ...c, zLayer: (c.zLayer ?? 0) + dir })),
      rev: st.rev + 1,
    })),
  toggleSnap: () => set((st) => ({ snapEnabled: !st.snapEnabled, guides: [] })),
  toggleGrid: () => set((st) => ({ showGrid: !st.showGrid })),

  pickConnectNode: (nodeId, kind = 'data') =>
    set((st) => {
      if (!st.pendingConnectFrom) return { pendingConnectFrom: nodeId, selectedMemberId: nodeId };
      if (st.pendingConnectFrom === nodeId) return { pendingConnectFrom: null }; // re-pick same → cancel
      // second pick → create the connection (dedupe either direction).
      const a = st.pendingConnectFrom;
      const exists = st.connections.some(
        (c) => (c.fromNodeId === a && c.toNodeId === nodeId) || (c.fromNodeId === nodeId && c.toNodeId === a),
      );
      if (exists) return { pendingConnectFrom: null };
      connSeq += 1;
      const conn: CompositeConnection = { id: `conn-${connSeq}`, fromNodeId: a, toNodeId: nodeId, kind };
      return { connections: [...st.connections, conn], pendingConnectFrom: null, rev: st.rev + 1 };
    }),
  cancelConnect: () => set({ pendingConnectFrom: null }),
  removeConnection: (id) => set((st) => ({ connections: st.connections.filter((c) => c.id !== id), rev: st.rev + 1 })),

  toggleMultiSelect: (compositeId) =>
    set((st) => ({
      multiSelect: st.multiSelect.includes(compositeId)
        ? st.multiSelect.filter((id) => id !== compositeId)
        : [...st.multiSelect, compositeId],
    })),
  clearMultiSelect: () => set({ multiSelect: [] }),
  groupSelection: () => {
    const st = get();
    if (st.multiSelect.length < 1) return null;
    groupSeq += 1;
    const groupId = `grp-${groupSeq}`;
    const sel = new Set(st.multiSelect);
    set((s) => ({
      composites: s.composites.map((c) => (sel.has(c.compositeId) ? { ...c, groupId } : c)),
      rev: s.rev + 1,
    }));
    return groupId;
  },

  // capture the current multi-selection (or the selected composite's group) as a
  // re-instantiable template (§6.4). Stores members + binding + stack parent (by
  // index) + roots relative to the selection centroid + the connections among them.
  saveAsTemplate: (name) => {
    const st = get();
    const ids = st.multiSelect.length > 0 ? st.multiSelect : st.selectedId ? [st.selectedId] : [];
    if (ids.length === 0) return null;
    const byId = byIdMap(st.composites);
    const set0 = new Set(ids);
    const picked = ids.map((id) => byId.get(id)!).filter(Boolean);
    if (picked.length === 0) return null;

    // centroid of the picked composites' world roots → relative anchoring.
    const worlds = picked.map((c) => effectiveRoot(c, byId));
    const cx = worlds.reduce((s, w) => s + w.x, 0) / worlds.length;
    const cy = worlds.reduce((s, w) => s + w.y, 0) / worlds.length;

    const indexOfId = (id: string | null | undefined) => (id ? ids.indexOf(id) : -1);
    const captured: CapturedComposite[] = picked.map((c, i) => ({
      templateId: c.templateId,
      caption: c.caption,
      // a stacked child stays relative to its parent; a free composite anchors to centroid.
      relRoot:
        c.parentCompositeId && set0.has(c.parentCompositeId)
          ? { x: c.root.x, y: c.root.y, z: c.root.z }
          : { x: worlds[i].x - cx, y: worlds[i].y - cy, z: c.root.z },
      staticMembers: c.templateId === 'nav-header' ? [] : c.staticMembers.map((m) => ({ ...m })),
      binding: c.binding ? JSON.parse(JSON.stringify(c.binding)) : undefined,
      parentIndex: c.parentCompositeId && set0.has(c.parentCompositeId) ? indexOfId(c.parentCompositeId) : -1,
      zLayer: c.zLayer,
    }));

    // capture connections whose BOTH endpoints are inside the selection.
    const memberIndex = new Map<string, [number, number]>(); // nodeId → [compIdx, memberIdx]
    picked.forEach((c, ci) => {
      compositeMembers(c, st.hubs).forEach((m, mi) => memberIndex.set(m.memberId, [ci, mi]));
    });
    const savedConns: SavedConnection[] = st.connections
      .filter((cn) => memberIndex.has(cn.fromNodeId) && memberIndex.has(cn.toNodeId))
      .map((cn) => ({ from: memberIndex.get(cn.fromNodeId)!, to: memberIndex.get(cn.toNodeId)!, kind: cn.kind }));

    templateSeq += 1;
    createdSeq += 1;
    const templateId = `user:${templateSeq}`;
    const tpl: SavedTemplate = {
      templateId,
      name: name ?? `Saved ${templateSeq}`,
      composites: captured,
      connections: savedConns,
      createdAt: createdSeq,
    };
    set((s) => ({ userTemplates: [...s.userTemplates, tpl], rev: s.rev + 1 }));
    return templateId;
  },

  // re-instantiate a saved template as a FRESH subgraph (new ids), registered in one
  // action (INV-0.4). Returns the new composite ids.
  instantiateUserTemplate: (templateId) => {
    const st = get();
    const tpl = st.userTemplates.find((t) => t.templateId === templateId);
    if (!tpl) return [];
    // drop point: a tidy slot in the lower workspace, staggered per instantiation.
    const inst = st.composites.filter((c) => c.savedFrom === templateId).length;
    const drop = { x: -3.0 + (inst % 3) * 3.0, y: -1.0 - Math.floor(inst / 3) * 3.0 };

    const newIds: string[] = [];
    const created: CompositeSchema[] = tpl.composites.map((cap) => {
      const c = makeComposite(cap.templateId, st.hubs, {
        caption: cap.caption,
        root: { x: drop.x + cap.relRoot.x, y: drop.y + cap.relRoot.y, z: cap.relRoot.z },
        staticMembers: cap.templateId === 'nav-header' ? [] : cap.staticMembers.map((m) => ({ ...m })),
        binding: cap.binding ? JSON.parse(JSON.stringify(cap.binding)) : undefined,
        zLayer: cap.zLayer,
        savedFrom: templateId,
      });
      newIds.push(c.compositeId);
      return c;
    });
    // re-link stack parents (by captured index) + re-mint member ids per composite so
    // every re-instantiated member is a fresh, uniquely-backed node.
    created.forEach((c, i) => {
      const cap = tpl.composites[i];
      if (cap.parentIndex >= 0 && created[cap.parentIndex]) c.parentCompositeId = created[cap.parentIndex].compositeId;
      // re-id static members (nav members derive, so only non-nav need re-id).
      if (c.templateId !== 'nav-header') {
        c.staticMembers = c.staticMembers.map((m, mi) => ({ ...m, memberId: `${c.compositeId}-m${mi}`, parentMemberId: m.parentMemberId ? `${c.compositeId}-base` : null }));
      }
    });
    // re-map saved connections to the new member node ids.
    const memberIdAt = (ci: number, mi: number): string | null => {
      const c = created[ci];
      if (!c) return null;
      const members = compositeMembers(c, st.hubs);
      return members[mi]?.memberId ?? null;
    };
    const newConns: CompositeConnection[] = [];
    for (const sc of tpl.connections) {
      const from = memberIdAt(sc.from[0], sc.from[1]);
      const to = memberIdAt(sc.to[0], sc.to[1]);
      if (from && to) {
        connSeq += 1;
        newConns.push({ id: `conn-${connSeq}`, fromNodeId: from, toNodeId: to, kind: sc.kind });
      }
    }
    set((s) => ({
      composites: [...s.composites, ...created],
      connections: [...s.connections, ...newConns],
      selectedId: newIds[0] ?? s.selectedId,
      rev: s.rev + 1,
    }));
    return newIds;
  },

  getComposite: (compositeId) => get().composites.find((c) => c.compositeId === compositeId),
  navTabs: (compositeId) => {
    const c = get().composites.find((x) => x.compositeId === compositeId);
    return c?.binding ? resolveNavTabs(get().hubs, c.binding) : [];
  },
  worldRootOf: (compositeId) => {
    const st = get();
    const byId = byIdMap(st.composites);
    const c = byId.get(compositeId);
    return c ? effectiveRoot(c, byId) : null;
  },
  nodeWorldPos: (nodeId) => {
    const st = get();
    const hubIdx = st.hubs.findIndex((h) => h.hubId === nodeId);
    if (hubIdx >= 0) {
      const [x, y, z] = hubPlanetPos(hubIdx);
      return { x, y, z };
    }
    const byId = byIdMap(st.composites);
    const loc = locateMember(st.composites, st.hubs, nodeId);
    if (!loc) return null;
    const wr = effectiveRoot(loc.composite, byId);
    return { x: wr.x + loc.member.local.x, y: wr.y + loc.member.local.y, z: wr.z + loc.member.local.z };
  },
  nodes: () => {
    const st = get();
    const byId = byIdMap(st.composites);
    const hubNodes = st.hubs.map((h, i) => hubToNode(h, i));
    const memberNodes = st.composites.flatMap((c) => {
      const wr = effectiveRoot(c, byId);
      return compositeMembers(c, st.hubs).map((m) => memberToNode(m, c, wr));
    });
    return [...hubNodes, ...memberNodes];
  },
  edges: () => {
    const st = get();
    const structural = st.composites.flatMap((c) => compositeEdges(c, st.hubs));
    const stackEdges: CompositeEdge[] = st.composites
      .filter((c) => c.parentCompositeId)
      .map((c) => ({ from: c.compositeId, to: c.parentCompositeId as string, kind: 'stack' as const }));
    const connEdges: CompositeEdge[] = st.connections.map((cn) => ({ from: cn.fromNodeId, to: cn.toNodeId, kind: cn.kind }));
    return [...structural, ...stackEdges, ...connEdges];
  },
}));

// Deterministic placement (by per-template ordinal) so composites don't overlap.
// Nav high-center, footer low-center, free panes/cubes stagger across the mid band.
function rootSlotFor(ordinal: number, templateId: CompositeTemplateId): { x: number; y: number; z: number } {
  if (templateId === 'nav-header') return { x: -0.4, y: 3.2, z: 0 };
  if (templateId === 'footer') return { x: -0.4, y: -3.8, z: 0 };
  if (templateId === 'pane' || templateId === 'cube') {
    return { x: -3.2 + (ordinal % 4) * 2.1, y: 0.4 - Math.floor(ordinal / 4) * 1.9, z: 0 };
  }
  return { x: -4.9 + (ordinal % 3) * 3.2, y: -1.4, z: 0 };
}

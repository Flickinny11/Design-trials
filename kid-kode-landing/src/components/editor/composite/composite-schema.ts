'use client';

// PRISM PRIMITIVE SYSTEM — P-4 — THE COMPOSITE SCHEMA (assemblies = subgraphs).
//
// A COMPOSITE template = a pre-assembled SUBGRAPH (primitive member nodes + spatial
// parent-child stacking + edges), instantiated as a UNIT (spec §4 / INV-0.4).
// Composites = subgraphs (the established bipartite-DAG model). Every member is a
// real NODE (Node Law §0); instantiating a composite registers ALL member nodes +
// edges in the lab graph in one action.
//
// THE BOUND NAV HEADER (the menu answer, spec §4.2): the nav's tab members + the
// dropdown's menu-item members are a DATA BINDING to the app's own HUB nodes — a
// VIEW over the hub set. They are NOT stored statically; they are DERIVED LIVE from
// (hubs ⊕ binding) by `resolveNavTabs`/`navMembers`. So:
//   • AUTO-POPULATE  — one tab + one menu item per hub falls out of the derivation.
//   • EDITABLE       — rename / reorder / hide / pin-manual are binding edits.
//   • AUTO-ADD       — ON: a new hub appears in the derivation automatically; OFF:
//                      the binding freezes to its knownHubIds snapshot.
// Because the tabs are derived, a new hub immediately yields one more backing tab
// NODE (no orphan, no manual reconcile) — the binding IS the derivation.
//
// Isolated editor-chrome — never the unified production graph scene. We REUSE the
// founder-approved chassis transmission-glass + worn-alloy language (P-1/P-2/P-3)
// so a composite MATCHES /toolbar-chassis + /keyframe-editor by construction.

import type { PrismNode, PrismIntent, MaterialSpec, MeshPrimitiveKind } from '@/lib/prism-graph/types';

// ── HUBS — the binding source of truth (mirrors production PrismHub) ─────────────
// In the app, hubs ARE the pages. The nav is a view over them. The lab carries a
// small multi-hub sample graph; each hub is itself a real NODE (a galaxy planet).
export interface LabHub {
  hubId: string;
  title: string;
  caption: string;
}

// ── COMPOSITE TEMPLATES (spec §4.3) ──────────────────────────────────────────────
// 'pane' / 'cube' are SINGLE-PRIMITIVE composites (one member) — the atoms a user
// freely places, stacks, connects, groups + saves in the P-5 composition workspace.
export type CompositeTemplateId = 'nav-header' | 'footer' | 'card' | 'pane' | 'cube';
export const COMPOSITE_TEMPLATES: readonly CompositeTemplateId[] = Object.freeze([
  'nav-header',
  'footer',
  'card',
] as const);

const TEMPLATE_LABEL: Record<CompositeTemplateId, string> = {
  'nav-header': 'Nav Header',
  footer: 'Footer',
  card: 'Card',
  pane: 'Pane',
  cube: 'Cube',
};

// ── MEMBER roles (the pieces of a subgraph) ──────────────────────────────────────
export type MemberRole =
  | 'nav-base'
  | 'nav-title'
  | 'nav-tab'
  | 'nav-dropdown'
  | 'nav-menu-item'
  | 'footer-base'
  | 'footer-link'
  | 'card-base'
  | 'card-media'
  | 'card-title'
  | 'card-body'
  | 'card-cta'
  // P-5 free-placed single primitives (the composition atoms).
  | 'prim-pane'
  | 'prim-cube';

// The realized geometry kind for a member (reuses the P-1 parametric builders +
// the P-3 liquid-glass surface for the dropdown).
export type MemberKind = 'pane' | 'cube' | 'fluid-surface';

// A member's material descriptor — the approved glass / worn-alloy vocabulary.
export type MemberMaterial =
  | 'glass-clear'
  | 'glass-tab'
  | 'glass-tab-active'
  | 'worn-sapphire'
  | 'worn-bronze'
  | 'worn-emerald'
  | 'worn-gunmetal'
  | 'liquid-glass';

export interface MemberTransform {
  x: number;
  y: number;
  z: number;
}

// One member node of a composite subgraph. Geometry params + material + a local
// transform RELATIVE to the composite root, plus parent-child + binding linkage.
export interface CompositeMember {
  memberId: string;
  role: MemberRole;
  kind: MemberKind;
  caption: string;
  /** local transform relative to the composite root (stacking; spec §6.1). */
  local: MemberTransform;
  /** the member this one is stacked onto (parent-child edge). null = composite root. */
  parentMemberId: string | null;
  width: number;
  height: number;
  depth: number;
  cornerRadius: number;
  material: MemberMaterial;
  /** BOUND members only (nav-tab / nav-menu-item): the hub this is a view of. */
  boundHubId?: string | null;
  /** a pinned, non-hub manual item (spec §4.2.2). */
  manual?: boolean;
}

// ── THE NAV BINDING (spec §4.2) — the editable view config over the hub set ──────
export interface NavManualItem {
  id: string;
  label: string;
}

export interface NavBinding {
  /** ON → new hubs appear in the nav automatically; OFF → frozen to knownHubIds. */
  autoAdd: boolean;
  /** the hub ids the binding "knows" — the frozen set used when autoAdd is OFF. */
  knownHubIds: string[];
  /** ordered tab keys (hubId or `manual:<id>`); entries here lead, rest append. */
  order: string[];
  /** hub ids explicitly hidden from the nav (spec §4.2.2). */
  hidden: string[];
  /** per-hub custom label override (rename; spec §4.2.2). */
  renames: Record<string, string>;
  /** pinned non-hub items (spec §4.2.2). */
  manualItems: NavManualItem[];
}

export function defaultNavBinding(hubs: LabHub[]): NavBinding {
  return {
    autoAdd: true,
    knownHubIds: hubs.map((h) => h.hubId),
    order: hubs.map((h) => h.hubId),
    hidden: [],
    renames: {},
    manualItems: [],
  };
}

// A resolved tab — the live VIEW the nav renders (one per visible hub + manual item).
export interface NavTab {
  key: string;
  label: string;
  boundHubId: string | null;
  manual: boolean;
}

// Resolve the nav's tabs from (hubs ⊕ binding) — the heart of the binding (§4.2.1).
//   • visible hubs = (autoAdd ? all hubs : hubs ∈ knownHubIds), minus hidden.
//   • one tab per visible hub (label = rename ?? title), plus one per manual item.
//   • ordered by binding.order; unordered entries append in natural order.
export function resolveNavTabs(hubs: LabHub[], binding: NavBinding): NavTab[] {
  const known = new Set(binding.knownHubIds);
  const hidden = new Set(binding.hidden);
  const visibleHubs = hubs.filter((h) => (binding.autoAdd || known.has(h.hubId)) && !hidden.has(h.hubId));

  const hubTabs: NavTab[] = visibleHubs.map((h) => ({
    key: h.hubId,
    label: binding.renames[h.hubId] ?? h.title,
    boundHubId: h.hubId,
    manual: false,
  }));
  const manualTabs: NavTab[] = binding.manualItems.map((m) => ({
    key: `manual:${m.id}`,
    label: m.label,
    boundHubId: null,
    manual: true,
  }));

  const all = [...hubTabs, ...manualTabs];
  const orderIdx = (key: string) => {
    const i = binding.order.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // stable sort by the binding order; ties keep insertion order.
  return all
    .map((t, i) => ({ t, i }))
    .sort((a, b) => orderIdx(a.t.key) - orderIdx(b.t.key) || a.i - b.i)
    .map(({ t }) => t);
}

// ── COMPOSITE SCHEMA ─────────────────────────────────────────────────────────────
export interface CompositeTransform {
  x: number;
  y: number;
  z: number;
}

export interface CompositeSchema {
  compositeId: string;
  templateId: CompositeTemplateId;
  caption: string;
  root: CompositeTransform;
  /** STATIC members (base, title, dropdown, footer/card pieces). Bound tab +
   *  menu-item members are DERIVED live from (hubs ⊕ binding), not stored here. */
  staticMembers: CompositeMember[];
  /** present only on the nav-header template (the bound view config). */
  binding?: NavBinding;

  // ── P-5 composition (spec §6) — all additive / optional ───────────────────────
  /** STACK (§6.1): the composite this one is stacked onto. When set, `root` is an
   *  OFFSET relative to the parent's world root, so moving the parent moves this. */
  parentCompositeId?: string | null;
  /** z-layering (§6.1): a small forward push per layer (resolved in effectiveRoot). */
  zLayer?: number;
  /** GROUP (§6.4): the multi-select group this composite belongs to (transient). */
  groupId?: string | null;
  /** provenance: the user template id this was instantiated from (§6.4). */
  savedFrom?: string;
}

// ── deterministic id minting (no Math.random — reproducible gate + verification) ──
const counters: Record<CompositeTemplateId, number> = { 'nav-header': 0, footer: 0, card: 0, pane: 0, cube: 0 };
export function mintCompositeId(t: CompositeTemplateId): string {
  counters[t] += 1;
  return `comp-${t}-${counters[t]}`;
}
export function resetCompositeCounters() {
  counters['nav-header'] = 0;
  counters.footer = 0;
  counters.card = 0;
  counters.pane = 0;
  counters.cube = 0;
}

// ── NAV layout constants (the bar sits across the top; tabs spread along it) ──────
export const NAV = {
  barH: 1.18,
  barDepth: 0.34,
  titleW: 2.2,
  tabW: 1.16,
  tabH: 0.74,
  tabDepth: 0.22,
  tabGap: 0.14,
  tabZ: 0.26,
  menuW: 1.16,
  pad: 0.44,
  sectionGap: 0.5,
  dropdownW: 3.0,
  dropdownH: 3.4,
  rowH: 0.48,
} as const;

// The bar SIZES to its tab count: [pad][title][gap][N tabs][gap][menu][pad]. So the
// auto-bound nav grows its bar as pages are added — never overflows, never collides.
export interface NavLayout {
  barW: number;
  titleX: number;
  tabStartX: number;
  menuX: number;
  dropdownLocal: { x: number; y: number; z: number };
}
export function navLayout(tabCount: number): NavLayout {
  const n = Math.max(0, tabCount);
  const tabsW = n > 0 ? n * NAV.tabW + (n - 1) * NAV.tabGap : 0;
  const contentW = NAV.titleW + NAV.sectionGap + tabsW + NAV.sectionGap + NAV.menuW;
  const barW = contentW + 2 * NAV.pad;
  const left = -barW / 2 + NAV.pad;
  return {
    barW,
    titleX: left + NAV.titleW / 2,
    tabStartX: left + NAV.titleW + NAV.sectionGap, // left edge of the first tab
    menuX: barW / 2 - NAV.pad - NAV.menuW / 2,
    dropdownLocal: { x: barW / 2 - NAV.pad - NAV.menuW / 2, y: -NAV.barH / 2 - NAV.dropdownH / 2 - 0.12, z: 0.05 },
  };
}

// ── TEMPLATE FACTORIES — the static skeleton of each composite ───────────────────
// The nav header has NO static skeleton: every member (base / title / tabs /
// dropdown / menu items) is DERIVED in `navMembers` from the live tab count, so the
// bar resizes as pages are bound. (footer / card carry a real static skeleton.)
function navStaticMembers(): CompositeMember[] {
  return [];
}

function footerStaticMembers(id: string): CompositeMember[] {
  const base: CompositeMember = {
    memberId: `${id}-base`,
    role: 'footer-base',
    kind: 'pane',
    caption: 'Footer Bar',
    local: { x: 0, y: 0, z: 0 },
    parentMemberId: null,
    width: 8.4,
    height: 1.5,
    depth: 0.3,
    cornerRadius: 0.26,
    material: 'glass-clear',
  };
  const linkLabels = ['About', 'Pricing', 'Docs', 'Contact'];
  const links: CompositeMember[] = linkLabels.map((label, i) => ({
    memberId: `${id}-link-${i}`,
    role: 'footer-link',
    kind: 'pane',
    caption: label,
    local: { x: -3.0 + i * 2.0, y: 0, z: 0.22 },
    parentMemberId: `${id}-base`,
    width: 1.7,
    height: 0.7,
    depth: 0.18,
    cornerRadius: 0.14,
    material: i % 2 === 0 ? 'worn-bronze' : 'worn-emerald',
  }));
  return [base, ...links];
}

function cardStaticMembers(id: string): CompositeMember[] {
  return [
    {
      memberId: `${id}-base`,
      role: 'card-base',
      kind: 'pane',
      caption: 'Card',
      local: { x: 0, y: 0, z: 0 },
      parentMemberId: null,
      width: 3.0,
      height: 4.0,
      depth: 0.3,
      cornerRadius: 0.26,
      material: 'glass-clear',
    },
    {
      memberId: `${id}-media`,
      role: 'card-media',
      kind: 'pane',
      caption: 'Media',
      local: { x: 0, y: 1.0, z: 0.2 },
      parentMemberId: `${id}-base`,
      width: 2.5,
      height: 1.7,
      depth: 0.16,
      cornerRadius: 0.16,
      material: 'worn-sapphire',
    },
    {
      memberId: `${id}-title`,
      role: 'card-title',
      kind: 'pane',
      caption: 'Title',
      local: { x: 0, y: -0.25, z: 0.2 },
      parentMemberId: `${id}-base`,
      width: 2.5,
      height: 0.5,
      depth: 0.14,
      cornerRadius: 0.1,
      material: 'worn-gunmetal',
    },
    {
      memberId: `${id}-body`,
      role: 'card-body',
      kind: 'pane',
      caption: 'Body',
      local: { x: 0, y: -1.0, z: 0.2 },
      parentMemberId: `${id}-base`,
      width: 2.5,
      height: 0.9,
      depth: 0.12,
      cornerRadius: 0.1,
      material: 'glass-tab',
    },
    {
      memberId: `${id}-cta`,
      role: 'card-cta',
      kind: 'cube',
      caption: 'Action',
      local: { x: 0, y: -1.72, z: 0.24 },
      parentMemberId: `${id}-base`,
      width: 1.3,
      height: 0.42,
      depth: 0.3,
      cornerRadius: 0.1,
      material: 'worn-emerald',
    },
  ];
}

// SINGLE-PRIMITIVE composites (P-5 atoms): one member, freely placeable. A Pane is
// the founder-approved clear-glass slab; a Cube is a worn-alloy block. These are what
// "stack two panes" / "connect two nodes" operate on.
function paneStaticMembers(id: string): CompositeMember[] {
  return [{
    memberId: `${id}-pane`, role: 'prim-pane', kind: 'pane', caption: 'Pane',
    local: { x: 0, y: 0, z: 0 }, parentMemberId: null,
    width: 2.2, height: 1.4, depth: 0.3, cornerRadius: 0.22, material: 'glass-clear',
  }];
}
function cubeStaticMembers(id: string): CompositeMember[] {
  return [{
    memberId: `${id}-cube`, role: 'prim-cube', kind: 'cube', caption: 'Cube',
    local: { x: 0, y: 0, z: 0 }, parentMemberId: null,
    width: 1.0, height: 1.0, depth: 1.0, cornerRadius: 0.16, material: 'worn-sapphire',
  }];
}

export function makeComposite(
  templateId: CompositeTemplateId,
  hubs: LabHub[],
  overrides?: Partial<CompositeSchema>,
): CompositeSchema {
  const compositeId = overrides?.compositeId ?? mintCompositeId(templateId);
  const staticMembers =
    templateId === 'nav-header'
      ? navStaticMembers()
      : templateId === 'footer'
        ? footerStaticMembers(compositeId)
        : templateId === 'card'
          ? cardStaticMembers(compositeId)
          : templateId === 'pane'
            ? paneStaticMembers(compositeId)
            : cubeStaticMembers(compositeId);
  return {
    compositeId,
    templateId,
    caption: overrides?.caption ?? `${TEMPLATE_LABEL[templateId]} ${compositeId.split('-').pop()}`,
    root: overrides?.root ?? { x: 0, y: 0, z: 0 },
    staticMembers: overrides?.staticMembers ?? staticMembers,
    binding: templateId === 'nav-header' ? (overrides?.binding ?? defaultNavBinding(hubs)) : undefined,
    parentCompositeId: overrides?.parentCompositeId ?? null,
    zLayer: overrides?.zLayer,
    groupId: overrides?.groupId ?? null,
    savedFrom: overrides?.savedFrom,
  };
}

// ── DERIVED MEMBERS — the bound tabs + menu items (the live VIEW) ─────────────────
// The full member list of a composite = its static skeleton + (for the nav) one tab
// per resolved NavTab + one dropdown menu item per resolved NavTab. This is where
// auto-populate / auto-add fall out: change the hubs/binding → the member list (and
// thus the backing node set) changes with zero manual reconcile.
export function navMembers(composite: CompositeSchema, hubs: LabHub[]): CompositeMember[] {
  const id = composite.compositeId;
  const tabs = resolveNavTabs(hubs, composite.binding!);
  const L = navLayout(tabs.length);
  const baseId = `${id}-base`;
  const dropdownId = `${id}-dropdown`;
  const dl = L.dropdownLocal;

  // the bar SIZES to its tab count, so it never overflows or collides.
  const base: CompositeMember = {
    memberId: baseId, role: 'nav-base', kind: 'pane', caption: 'Header Bar',
    local: { x: 0, y: 0, z: 0 }, parentMemberId: null,
    width: L.barW, height: NAV.barH, depth: NAV.barDepth, cornerRadius: 0.3, material: 'glass-clear',
  };
  const title: CompositeMember = {
    memberId: `${id}-title`, role: 'nav-title', kind: 'pane', caption: 'Brand',
    local: { x: L.titleX, y: 0, z: NAV.tabZ }, parentMemberId: baseId,
    width: NAV.titleW, height: NAV.tabH, depth: NAV.tabDepth, cornerRadius: 0.16, material: 'worn-sapphire',
  };
  const dropdown: CompositeMember = {
    memberId: dropdownId, role: 'nav-dropdown', kind: 'fluid-surface', caption: 'Menu',
    local: { ...dl }, parentMemberId: baseId,
    width: NAV.dropdownW, height: NAV.dropdownH, depth: 0.2, cornerRadius: 0.22, material: 'liquid-glass',
  };

  // one tab per resolved NavTab, spread along the bar right of the title block.
  const tabMembers: CompositeMember[] = tabs.map((t, i) => ({
    memberId: `${id}-tab-${t.key}`, role: 'nav-tab', kind: 'pane', caption: t.label,
    local: { x: L.tabStartX + NAV.tabW / 2 + i * (NAV.tabW + NAV.tabGap), y: 0, z: NAV.tabZ },
    parentMemberId: baseId,
    width: NAV.tabW, height: NAV.tabH, depth: NAV.tabDepth, cornerRadius: 0.14,
    material: t.manual ? 'glass-tab-active' : 'glass-tab', boundHubId: t.boundHubId, manual: t.manual,
  }));

  // one menu item per resolved tab, stacked down the dropdown panel. Root-relative
  // (= dropdown anchor + row offset) so node world positions stay consistent; the
  // DropdownNode re-nests them into its animated group for the expand reveal.
  const menuMembers: CompositeMember[] = tabs.map((t, i) => ({
    memberId: `${id}-mi-${t.key}`, role: 'nav-menu-item', kind: 'pane', caption: t.label,
    local: { x: dl.x, y: dl.y + (NAV.dropdownH / 2 - 0.46 - i * NAV.rowH), z: dl.z + 0.14 },
    parentMemberId: dropdownId,
    width: NAV.dropdownW - 0.5, height: 0.4, depth: 0.08, cornerRadius: 0.1,
    material: t.manual ? 'glass-tab-active' : 'glass-tab', boundHubId: t.boundHubId, manual: t.manual,
  }));

  return [base, title, dropdown, ...tabMembers, ...menuMembers];
}

export function compositeMembers(composite: CompositeSchema, hubs: LabHub[]): CompositeMember[] {
  if (composite.templateId === 'nav-header') return navMembers(composite, hubs);
  return composite.staticMembers;
}

// ── EDGES — the subgraph linkage (parent-child stacking + data bindings) ─────────
// P-5 adds 'stack' (cross-composite parent stacking, §6.1) and 'data' / 'logic'
// (user-drawn CONNECT edges with visible 3D connectors, §6.2).
export type CompositeEdgeKind = 'parent' | 'binding' | 'stack' | 'data' | 'logic';
export interface CompositeEdge {
  from: string;
  to: string;
  kind: CompositeEdgeKind;
}

// ── CONNECT (spec §6.2) — a user-drawn graph edge between two member NODES ────────
export type ConnectionKind = 'data' | 'logic';
export interface CompositeConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: ConnectionKind;
}

// ── SAVE-AS-TEMPLATE (spec §6.4) — a user-grown composite library entry ───────────
// A deep snapshot of a selection: each captured composite carries its members + (for
// the nav) its binding + its stack parent (by index) + its root RELATIVE to the
// selection centroid, so re-instantiation rebuilds the whole assembly as a fresh
// subgraph (new ids) anywhere on the canvas (INV-0.4).
export interface CapturedComposite {
  templateId: CompositeTemplateId;
  caption: string;
  relRoot: CompositeTransform;
  staticMembers: CompositeMember[];
  binding?: NavBinding;
  parentIndex: number; // index of the stack parent within the captured set, or -1
  zLayer?: number;
}
export interface SavedConnection {
  from: [number, number]; // [compositeIndex, memberIndex] within the captured set
  to: [number, number];
  kind: ConnectionKind;
}
export interface SavedTemplate {
  templateId: string; // 'user:<n>'
  name: string;
  composites: CapturedComposite[];
  connections: SavedConnection[];
  createdAt: number; // a monotonic counter (deterministic — no Date.now)
}

// All edges for a composite: parent-child stacking edges (member→parent member) +
// binding edges (bound tab/menu member → its hub node). The binding edges make the
// nav a genuine GRAPH view over the hub nodes (spec §4.2), not a hardcoded copy.
export function compositeEdges(composite: CompositeSchema, hubs: LabHub[]): CompositeEdge[] {
  const members = compositeMembers(composite, hubs);
  const edges: CompositeEdge[] = [];
  for (const m of members) {
    if (m.parentMemberId) edges.push({ from: m.memberId, to: m.parentMemberId, kind: 'parent' });
    if (m.boundHubId) edges.push({ from: m.memberId, to: m.boundHubId, kind: 'binding' });
  }
  return edges;
}

// ── NODE LAW: members + hubs → PrismNode (spec §0) ───────────────────────────────
const MAT_SPECS: Record<MemberMaterial, MaterialSpec> = {
  'glass-clear': { baseColor: '#dbe8f2', metalness: 0, roughness: 0.05, transmission: 1, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.17, thickness: 0.7, envMapIntensity: 1.05, opacity: 1 },
  'glass-tab': { baseColor: '#cfe0ee', metalness: 0, roughness: 0.08, transmission: 0.92, ior: 1.48, clearcoat: 1, clearcoatRoughness: 0.2, thickness: 0.5, envMapIntensity: 1.0, opacity: 1 },
  'glass-tab-active': { baseColor: '#a9d6ff', metalness: 0, roughness: 0.06, transmission: 0.9, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.14, thickness: 0.5, envMapIntensity: 1.1, emissive: '#1d3346', emissiveIntensity: 0.3, opacity: 1 },
  'worn-sapphire': { baseColor: '#ffffff', metalness: 1, roughness: 1, transmission: 0, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, opacity: 1 },
  'worn-bronze': { baseColor: '#ffffff', metalness: 1, roughness: 1, transmission: 0, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, opacity: 1 },
  'worn-emerald': { baseColor: '#ffffff', metalness: 1, roughness: 1, transmission: 0, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, opacity: 1 },
  'worn-gunmetal': { baseColor: '#ffffff', metalness: 1, roughness: 1, transmission: 0, clearcoat: 0.08, clearcoatRoughness: 0.65, envMapIntensity: 0.95, normalScale: 1.35, opacity: 1 },
  'liquid-glass': { baseColor: '#ffffff', metalness: 0, roughness: 0.05, transmission: 1, ior: 1.45, dispersion: 1.2, clearcoat: 1, clearcoatRoughness: 0.12, iridescence: 0.35, iridescenceIOR: 1.3, thickness: 1.4, envMapIntensity: 1.15, opacity: 1 },
};

const KIND_TO_MESH: Record<MemberKind, MeshPrimitiveKind> = {
  pane: 'plane',
  cube: 'cube',
  'fluid-surface': 'plane',
};

function emptyIntent(caption: string): PrismIntent {
  return {
    caption,
    behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
    stateEffects: [],
    visualSpec: { textContent: [], layers: [] },
    contracts: { inputs: {}, outputs: {} },
  };
}

export const LAB_HUB_ID = 'composite-lab-hub';

// A composite member → a genuine PrismNode (meshPrimitive ⇒ hasRealArtifact passes).
// parentHubId = the composite id (the subgraph container). The world scenePosition
// is the composite's WORLD root (its own root composed up the parent-stack chain,
// P-5 §6.1) composed with the member's local transform (the in-composite stacking).
// `worldRoot` overrides composite.root when the composite is stacked onto a parent.
export function memberToNode(
  member: CompositeMember,
  composite: CompositeSchema,
  worldRoot?: { x: number; y: number; z: number },
): PrismNode {
  const r = worldRoot ?? composite.root;
  const wx = r.x + member.local.x;
  const wy = r.y + member.local.y;
  const wz = r.z + member.local.z;
  return {
    nodeId: member.memberId,
    subtype: `composite-${member.role}`,
    parentHubId: composite.compositeId,
    serviceTag: 'ui-3d',
    visual: { transform: { x: wx, y: wy, width: member.width, height: member.height, z: wz }, shape: 'rounded' },
    intent: emptyIntent(member.caption),
    codeRef: '',
    backendRef: null,
    renderMode: 'mesh',
    contentType: '3d-object',
    meshPrimitive: {
      kind: KIND_TO_MESH[member.kind],
      params: { width: member.width, height: member.height, depth: member.depth, radius: 0, segments: 1 },
    },
    materialSpec: MAT_SPECS[member.material],
    scenePosition: { x: wx, y: wy, z: wz, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
  };
}

// The hub-planet column — a tidy vertical "PAGES" stack to the left of the nav, so a
// reviewer SEES the pages the tabs mirror (add a planet → a tab appears). Shared by
// hubToNode + the HubPlanets renderer so node metadata and the render agree.
export function hubPlanetPos(index: number): [number, number, number] {
  return [-7.9, 3.5 - index * 0.95, 0.2];
}

// A hub → a genuine PrismNode (the page; rendered as a galaxy planet). A small
// sphere meshPrimitive keeps it node-backed for the authorship gate.
export function hubToNode(hub: LabHub, index: number): PrismNode {
  const [x, y, z] = hubPlanetPos(index);
  return {
    nodeId: hub.hubId,
    subtype: 'hub-page',
    parentHubId: LAB_HUB_ID,
    serviceTag: 'page',
    visual: { transform: { x, y, width: 0.64, height: 0.64, z }, shape: 'circle' },
    intent: emptyIntent(hub.title),
    codeRef: '',
    backendRef: null,
    renderMode: 'mesh',
    contentType: '3d-object',
    meshPrimitive: { kind: 'sphere', params: { width: 0.64, height: 0.64, depth: 0.64, radius: 0.32, segments: 32 } },
    materialSpec: { baseColor: '#9fd8ff', metalness: 0.1, roughness: 0.3, transmission: 0.6, ior: 1.4, clearcoat: 0.6, clearcoatRoughness: 0.2, thickness: 0.6, emissive: '#1d3346', emissiveIntensity: 0.4, envMapIntensity: 1, opacity: 1 },
    scenePosition: { x, y, z, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
  };
}

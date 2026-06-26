'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — THE LIBRARY CATALOG (spec §7.2).
//
// The browsable index of the in-canvas library/palette. Four sections, each entry a
// real, instantiable building block from the engines shipped in P-1..P-5:
//   • Primitives  — the parametric geometry atoms (P-1: Pane / Cube / Sphere).
//   • Composites  — pre-assembled SUBGRAPHS (P-4/P-5: bound nav header, footer, card).
//   • Materials   — the curated PBR registry + fluids (P-2/P-3) — the "skins".
//   • Saved       — the user's own grown-from-canvas templates (P-5 §6.4).
//
// Every entry carries an `EntrySpec` that BOTH the live preview tile (LibraryTile)
// and the instantiation pipeline (use-library-store) read — one description, two
// consumers, so a tile previews exactly what dropping it instantiates. No DOM.

import { PRIMITIVE_KINDS, type PrimitiveKind } from '@/components/editor/primitive/primitive-schema';
import { allMaterials, populatedFamilies } from '@/components/editor/material/material-registry';
import { FLUID_KINDS, type FluidKind } from '@/components/editor/fluid/fluid-schema';
import type { CompositeTemplateId } from '@/components/editor/composite/composite-schema';
import type { MaterialFamily } from '@/components/editor/material/material-types';

export type LibrarySection = 'primitives' | 'composites' | 'materials' | 'saved';

export const LIBRARY_SECTIONS: readonly LibrarySection[] = Object.freeze([
  'primitives',
  'composites',
  'materials',
  'saved',
] as const);

export const SECTION_LABEL: Record<LibrarySection, string> = {
  primitives: 'PRIMITIVES',
  composites: 'COMPOSITES',
  materials: 'MATERIALS',
  saved: 'SAVED',
};

// A "Fluids" pseudo-family inside the Materials section (the living material, P-3).
export const FLUIDS_GROUP = 'Fluids';

// ── the entry spec — what a tile previews and what dropping it instantiates ───────
export type EntrySpec =
  | { t: 'primitive'; kind: PrimitiveKind }
  | { t: 'material'; materialId: string }
  | { t: 'fluid'; kind: FluidKind }
  | { t: 'composite'; templateId: CompositeTemplateId }
  | { t: 'saved'; savedId: string };

export interface LibraryEntry {
  /** stable catalog id (e.g. 'prim:pane', 'mat:gem.ruby', 'comp:footer'). */
  id: string;
  section: LibrarySection;
  /** sub-group for filtering + the materials family sub-tabs (family or FLUIDS_GROUP). */
  group: string;
  label: string;
  spec: EntrySpec;
}

const PRIM_LABEL: Record<PrimitiveKind, string> = { pane: 'Pane', cube: 'Cube', sphere: 'Sphere' };
const FLUID_LABEL: Record<FluidKind, string> = { surface: 'Liquid Glass', volume: 'Fluid Volume' };

// The three built-in composite SUBGRAPH templates surfaced in the library. (The
// single-primitive 'pane' / 'cube' atoms live in the Primitives section instead.)
const COMPOSITE_ENTRIES: { templateId: CompositeTemplateId; label: string }[] = [
  { templateId: 'nav-header', label: 'Nav Header' },
  { templateId: 'footer', label: 'Footer' },
  { templateId: 'card', label: 'Card' },
];

// ── the static catalog (Primitives · Composites · Materials+Fluids) ──────────────
// Saved entries are dynamic (held in the store) and merged in by `libraryCatalog`.
export function staticCatalog(): LibraryEntry[] {
  const out: LibraryEntry[] = [];

  // PRIMITIVES — the parametric atoms.
  for (const kind of PRIMITIVE_KINDS) {
    out.push({ id: `prim:${kind}`, section: 'primitives', group: 'Geometry', label: PRIM_LABEL[kind], spec: { t: 'primitive', kind } });
  }

  // COMPOSITES — pre-assembled subgraphs.
  for (const c of COMPOSITE_ENTRIES) {
    out.push({ id: `comp:${c.templateId}`, section: 'composites', group: 'Assemblies', label: c.label, spec: { t: 'composite', templateId: c.templateId } });
  }

  // MATERIALS — the full curated registry, family by family.
  for (const def of allMaterials()) {
    out.push({ id: `mat:${def.id}`, section: 'materials', group: def.family, label: def.label, spec: { t: 'material', materialId: def.id } });
  }
  // MATERIALS · Fluids — the living material (P-3) lives in the Materials section.
  for (const kind of FLUID_KINDS) {
    out.push({ id: `fluid:${kind}`, section: 'materials', group: FLUIDS_GROUP, label: FLUID_LABEL[kind], spec: { t: 'fluid', kind } });
  }

  return out;
}

// The ordered list of material sub-group tabs (populated registry families + Fluids).
export function materialGroups(): string[] {
  return [...(populatedFamilies() as MaterialFamily[]), FLUIDS_GROUP];
}

// Case-insensitive search over label + group + section. Empty query → all entries.
export function filterEntries(entries: LibraryEntry[], query: string): LibraryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (e) => e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q) || e.section.toLowerCase().includes(q),
  );
}

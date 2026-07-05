'use client';

// PRISM MATERIAL SYSTEM — the reusable REGISTRY (spec §2.5).
//
// One curated, family-grouped library keyed by id. Primitive schemas reference a
// material by id (+ optional per-instance param overrides); a generated material
// (prompt-to-texture, W-PROMPT) is registered here at runtime and is immediately
// reusable across primitives. The 5 worn-alloy seeds reference the committed
// chassis-worn PBR sets so the metals match /toolbar-chassis by construction.

import type { MaterialDef, MaterialFamily, MaterialMapsRef } from './material-types';
import { FAMILIES } from './material-types';
import { METALS } from './families/metals';
import { STONES } from './families/stones';
import { GLASSES } from './families/glass';
import { GEMS } from './families/gems';
import { WOODS } from './families/woods';
import { CERAMICS } from './families/ceramics';
import { FABRICS } from './families/fabrics';
import { EXOTIC } from './families/exotic';
import { GENERATED_SEED } from './families/generated';

// ── runtime-registered generated materials (prompt-to-texture; W-PROMPT) ────────
// Pre-generated seeds ship in GENERATED_SEED; live generations push here.
const RUNTIME_GENERATED: MaterialDef[] = [];

export function registerGeneratedMaterial(def: MaterialDef): void {
  if (!RUNTIME_GENERATED.some((d) => d.id === def.id) && !GENERATED_SEED.some((d) => d.id === def.id)) {
    RUNTIME_GENERATED.push(def);
    rebuild();
  }
}

// ── assembled library ───────────────────────────────────────────────────────────
const STATIC_FAMILIES: MaterialDef[] = [
  ...METALS,
  ...STONES,
  ...GLASSES,
  ...GEMS,
  ...WOODS,
  ...CERAMICS,
  ...FABRICS,
  ...EXOTIC,
  ...GENERATED_SEED,
];

let ALL: MaterialDef[] = [...STATIC_FAMILIES];
let BY_ID = new Map<string, MaterialDef>(ALL.map((d) => [d.id, d]));

function rebuild() {
  ALL = [...STATIC_FAMILIES, ...RUNTIME_GENERATED];
  BY_ID = new Map(ALL.map((d) => [d.id, d]));
}

export function allMaterials(): MaterialDef[] {
  return ALL;
}

export function getMaterial(id: string): MaterialDef | undefined {
  return BY_ID.get(id);
}

export function materialsByFamily(family: MaterialFamily): MaterialDef[] {
  return ALL.filter((d) => d.family === family);
}

// Families that actually have entries, in canonical order (drives palette rows).
export function populatedFamilies(): MaterialFamily[] {
  return FAMILIES.filter((f) => ALL.some((d) => d.family === f));
}

// ── textured map-set bookkeeping (worn seeds + generated dirs) ───────────────────
// A stable key for a maps ref so the loader + the builder agree on the record key.
export function MAP_SET_KEY(ref: MaterialMapsRef): string {
  return ref.source === 'worn' ? `worn:${ref.wornKey}` : `gen:${ref.dir}`;
}

// The de-duplicated set of textured map refs the registry references (the loader
// streams exactly these). Recomputed lazily so runtime-registered generated
// materials' maps are included once they exist on disk.
export function texturedMapSets(): MaterialMapsRef[] {
  const seen = new Set<string>();
  const out: MaterialMapsRef[] = [];
  for (const d of ALL) {
    if (!d.maps) continue;
    const k = MAP_SET_KEY(d.maps);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d.maps);
  }
  return out;
}

// Static snapshot for the Suspense loader (the 5 worn seeds + pre-generated seeds).
// Runtime generations load their maps on demand when first applied (W-PROMPT).
export const TEXTURED_MAP_SETS: MaterialMapsRef[] = (() => {
  const seen = new Set<string>();
  const out: MaterialMapsRef[] = [];
  for (const d of STATIC_FAMILIES) {
    if (!d.maps) continue;
    const k = MAP_SET_KEY(d.maps);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d.maps);
  }
  return out;
})();

// ── legacy bridge: P-1's 8 MaterialKind literals → registry ids ─────────────────
// So existing PrimitiveSchema material kinds resolve through the registry without
// any production-type change (the lab schema keeps `kind` for back-compat).
export const LEGACY_KIND_TO_ID: Record<string, string> = {
  'glass-clear': 'glass.clear',
  'glass-smoke': 'glass.smoke',
  'glass-tinted': 'glass.tinted',
  'worn-emerald': 'metal.worn-emerald',
  'worn-sapphire': 'metal.worn-sapphire',
  'worn-bronze': 'metal.worn-bronze',
  'worn-oxblood': 'metal.worn-oxblood',
  'worn-gunmetal': 'metal.worn-gunmetal',
};

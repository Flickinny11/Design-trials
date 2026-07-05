// P2 TOOLBAR WIRING (Task B) — pure AnimationBinding helpers for the Animation
// toolbar group (canvas-spec §5 Animation group, §8.2 driver model, §8.3
// catalog; criteria 12/13).
//
// Everything here is PURE and node-testable (tests/editor-build/
// P2-animation-ui-helpers.test.ts): no React, no DOM, no three, no stores.
// The flyout component composes these against the frozen AnimationBinding
// contract in src/lib/prism-graph/types.ts and writes results through the
// toolbar-sanctioned useGraphSourceStore updateNode route (FP-15 restricts
// Inspector tabs, not the toolbar — same family as the Lighting group).
//
// Immutability contract: every mutator returns a NEW array of NEW entry
// objects for anything it touches; inputs are never mutated (the source store
// replaces `animationBindings` wholesale via updateNode).

import type {
  AnimationBinding,
  AnimationBindingDriverOptions,
  AnimationDriverKind,
} from '@/lib/prism-graph/types';

// ── Driver selector vocabulary (canvas-spec §5 trigger buttons → §8.2) ──────
// The chips the bound-list renders. 'time' is surfaced as "Load/Time": a
// load-triggered animation IS the master-clock TimeDriver playing from t=0.
// 'inview' (W8 E8) is the real section-aware reveal driver.
export const DRIVER_OPTIONS: ReadonlyArray<{
  driver: AnimationDriverKind;
  label: string;
}> = [
  { driver: 'time', label: 'Load/Time' },
  { driver: 'scroll', label: 'Scroll' },
  { driver: 'inview', label: 'In View' },
  { driver: 'pointer', label: 'Pointer' },
  { driver: 'state', label: 'State' },
  { driver: 'event', label: 'Event' },
];

export function driverLabel(driver: AnimationDriverKind): string {
  return DRIVER_OPTIONS.find((d) => d.driver === driver)?.label ?? driver;
}

// ── Binding id minting ('ab-' + base36 — mirrors the Lighting group's
// makeLight id convention in CanvasToolbar) ─────────────────────────────────
export const BINDING_ID_RE = /^ab-[0-9a-z]+-[0-9a-z]+$/;

let bindingSeq = 0;

/** Mint a stable binding id: `ab-<now base36>-<seq base36>`. The module-level
 *  sequence keeps ids unique within a session even when `now` collides. `now`
 *  is injectable for deterministic tests. */
export function mintBindingId(now: number = Date.now()): string {
  bindingSeq += 1;
  return `ab-${now.toString(36)}-${bindingSeq.toString(36)}`;
}

// ── Order normalization ─────────────────────────────────────────────────────
/** Stable sort by `order` (missing order falls back to array position).
 *  Returns a new array; entries are shared (read-only view). */
export function sortBindings(
  bindings: ReadonlyArray<AnimationBinding>,
): AnimationBinding[] {
  return bindings
    .map((b, i) => ({ b, key: b.order ?? i, i }))
    .sort((x, y) => x.key - y.key || x.i - y.i)
    .map((x) => x.b);
}

/** Re-sequence `order` to the array position (0..n-1) on every entry. */
function resequence(bindings: ReadonlyArray<AnimationBinding>): AnimationBinding[] {
  return bindings.map((b, i) => (b.order === i ? { ...b } : { ...b, order: i }));
}

// ── Mutators (all immutable) ────────────────────────────────────────────────
/** Append a fresh catalog binding: `{ id, primitive, driver: 'time',
 *  params: {} }` plus the next stacking `order` (criterion 13). Accepts the
 *  node's current (possibly undefined) list. */
export function appendBinding(
  bindings: ReadonlyArray<AnimationBinding> | undefined,
  primitive: string,
  id: string = mintBindingId(),
): AnimationBinding[] {
  const cur = bindings ?? [];
  const nextOrder = cur.reduce((m, b) => Math.max(m, (b.order ?? -1) + 1), cur.length);
  return [
    ...cur.map((b) => ({ ...b })),
    { id, primitive, driver: 'time' as const, params: {}, order: nextOrder },
  ];
}

/** Remove by id and close the order gap (re-sequenced 0..n-1). Unknown id →
 *  content-equal copy. */
export function removeBinding(
  bindings: ReadonlyArray<AnimationBinding>,
  id: string,
): AnimationBinding[] {
  return resequence(sortBindings(bindings).filter((b) => b.id !== id));
}

/** Move a binding one step up (-1) or down (+1) in stacking order, writing
 *  normalized `order` values. Clamped at the edges (no wrap). */
export function moveBinding(
  bindings: ReadonlyArray<AnimationBinding>,
  id: string,
  dir: -1 | 1,
): AnimationBinding[] {
  const sorted = sortBindings(bindings);
  const idx = sorted.findIndex((b) => b.id === id);
  if (idx === -1) return resequence(sorted);
  const target = idx + dir;
  if (target < 0 || target >= sorted.length) return resequence(sorted);
  const next = [...sorted];
  [next[idx], next[target]] = [next[target], next[idx]];
  return resequence(next);
}

/** Swap ONLY the driver field (canvas-spec §5 trigger buttons assign the
 *  Driver; changing a driver never edits keyframes/params — INV-6). */
export function setBindingDriver(
  bindings: ReadonlyArray<AnimationBinding>,
  id: string,
  driver: AnimationDriverKind,
): AnimationBinding[] {
  return bindings.map((b) => (b.id === id ? { ...b, driver } : { ...b }));
}

/** Merge driver-level options (section-scrub / inview-replay) onto a binding
 *  (W8 E8). Never touches keyframes/params — INV-6. A merge that resolves to an
 *  empty object drops the field entirely so legacy bindings stay byte-stable. */
export function setBindingDriverOptions(
  bindings: ReadonlyArray<AnimationBinding>,
  id: string,
  patch: Partial<AnimationBindingDriverOptions>,
): AnimationBinding[] {
  return bindings.map((b) => {
    if (b.id !== id) return { ...b };
    const merged: AnimationBindingDriverOptions = { ...b.driverOptions, ...patch };
    // Drop keys whose value is falsy/undefined so `{}` never lingers.
    const cleaned: AnimationBindingDriverOptions = {};
    if (merged.section) cleaned.section = true;
    if (merged.replay) cleaned.replay = true;
    const next = { ...b };
    if (cleaned.section || cleaned.replay) next.driverOptions = cleaned;
    else delete next.driverOptions;
    return next;
  });
}

/** Replace a binding's ControlSchema param overrides (copied, never aliased). */
export function setBindingParams(
  bindings: ReadonlyArray<AnimationBinding>,
  id: string,
  params: Record<string, number | string | boolean>,
): AnimationBinding[] {
  return bindings.map((b) =>
    b.id === id ? { ...b, params: { ...params } } : { ...b },
  );
}

// ── Picker filtering (search box + category chips) ──────────────────────────
/** Structural slice of PrimitiveDefinition the filter needs — keeps this
 *  module free of the registry (and of three) so it stays node-testable. */
export interface PickerEntry {
  name: string;
  label: string;
  category: string;
  description: string;
}

/** Case-insensitive substring search over name/label/description/category,
 *  optionally narrowed to one category chip, capped at `max` results. */
export function filterPrimitives<T extends PickerEntry>(
  defs: ReadonlyArray<T>,
  query: string,
  category: string | null,
  max: number = Number.POSITIVE_INFINITY,
): T[] {
  const q = query.trim().toLowerCase();
  const out: T[] = [];
  for (const d of defs) {
    if (category && d.category !== category) continue;
    if (
      q &&
      !d.name.toLowerCase().includes(q) &&
      !d.label.toLowerCase().includes(q) &&
      !d.description.toLowerCase().includes(q) &&
      !d.category.toLowerCase().includes(q)
    ) {
      continue;
    }
    out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

// ── Pagination (the live tile grid renders one fixed page at a time so GPU
// preview windows never half-scroll out of the flyout) ──────────────────────
export function pageCount(total: number, perPage: number): number {
  if (perPage <= 0) return 1;
  return Math.max(1, Math.ceil(total / perPage));
}

export function clampPage(page: number, total: number, perPage: number): number {
  return Math.min(Math.max(0, page), pageCount(total, perPage) - 1);
}

export function pageSlice<T>(items: ReadonlyArray<T>, page: number, perPage: number): T[] {
  const p = clampPage(page, items.length, perPage);
  return items.slice(p * perPage, (p + 1) * perPage);
}

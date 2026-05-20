// EBR2-F-05 / §R2-F SC-076 — Pure helpers for the pointer-up commit of a
// Clone-drag. Live as a module-level pure function (no DOM, no store reads,
// no allocations beyond the returned object) so the source-store action and
// the GraphScene pointerup handler can share the same caption rule.
//
// The Clone flow:
//   1. EBR2-F-02 cloneNode(sourceId)  → deep clone with `(clone)` caption suffix
//      and parentHubId carried over from source.
//   2. EBR2-F-04 pointermove listener → tracks nearest hub via findNearestHub.
//   3. EBR2-F-05 pointerup commit     → updates parentHubId on the clone to
//      the nearest hub at release and rewrites the caption to advertise the
//      new parent (the hub title). Subtype is intentionally untouched
//      (carries over from source per SC-076's "subtype reflect the new
//      parent context"; subtype is taxonomy, not display, and the source's
//      taxonomy IS the new parent's taxonomy slot).

import type { PrismHub } from '@/lib/prism-graph/types';

/**
 * Compose the post-commit caption for a Clone-drag. The new caption echoes
 * the destination hub's title so the Inspector shows "where the clone lives
 * now"; the `(clone)` suffix placed by cloneNode is preserved so the user
 * can still distinguish clone from source.
 *
 * Format: `<hubTitle> — <baseCaption> (clone)`.
 *
 * If `currentCaption` already carries a hub-title prefix from a prior
 * commit (e.g. the user re-parents the clone twice without losing it from
 * the cursor), the previous prefix is stripped before the new one is
 * applied so prefixes do not stack.
 */
export function composeCloneCommitCaption(
  currentCaption: string,
  hubTitle: string,
): string {
  // Strip any prior "<prefix> — " segment so re-parents do not stack.
  const withoutPrefix = currentCaption.replace(/^.+?\s—\s/, '');
  // The cloneNode action always appends " (clone)" — preserve it if present.
  const hasCloneSuffix = /\(clone\)$/.test(withoutPrefix);
  const base = hasCloneSuffix
    ? withoutPrefix.replace(/\s*\(clone\)$/, '')
    : withoutPrefix;
  const suffix = hasCloneSuffix ? ' (clone)' : '';
  return `${hubTitle} — ${base}${suffix}`;
}

/**
 * Resolve a hub's display title for caption composition. Falls back to the
 * hubId when title is empty; PrismHub.title is required by the schema but
 * legacy fixtures sometimes omit it.
 */
export function hubTitleFor(hub: PrismHub): string {
  return (hub.title && hub.title.length > 0) ? hub.title : hub.hubId;
}

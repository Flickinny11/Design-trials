// preview-app-routing.ts — Phase 10 / SC-054 routing helpers.
//
// Spec refs:
//   §10 SC-054  `preview-app` mode renders all hubs in order with route-like
//                navigation (URL or hash route maps to active hub).
//   §8  INV-17  Non-destructive: routing helpers never mutate the compiled
//                view or its inputs. Pure data in, pure data out.
//   §8  INV-20  Selection state survives every transition through any subset of
//                the five canonical view modes — the hub navigation in this
//                module is one such transition, so callers (page.tsx) MUST set
//                `activeHubId` without touching `selectedNodeId/Hub*Id`.
//
// The DOM side of the wire — `history.pushState`, `popstate`, `location.hash` —
// lives in `src/app/page.tsx`. This module is pure-data so it can unit-test
// without jsdom and so the routing rule table is auditable in isolation.
//
// Hash format: `#hub=<encodeURIComponent(hubId)>`. URL/pathname routing was
// left underspecified by the spec ("URL or hash route"); hash routing is
// chosen because preview-app coexists with the rest of the editor on `/` and
// must not require Next.js page-route changes.

import type { CompiledAppView } from './compile-app';

/** Documented prefix for the preview-app hash route. Hard-coded so the test
 *  contract pins the literal string. */
export const PREVIEW_APP_HASH_PREFIX = '#hub=';

/** Build a route hash for a given hub id. URI-encoded so hub ids containing
 *  reserved characters (`&`, `=`, `#`, spaces) survive a round trip through
 *  `location.hash`. */
export function serializePreviewAppHash(hubId: string): string {
  return `${PREVIEW_APP_HASH_PREFIX}${encodeURIComponent(hubId)}`;
}

/** Parse `location.hash` into a hubId, returning `null` when the hash is
 *  missing, malformed, or names a hub that is not in the compiled view.
 *  Pure: never mutates `compiled` or any nested entry. */
export function parsePreviewAppHash(
  hash: string,
  compiled: CompiledAppView,
): string | null {
  if (typeof hash !== 'string' || hash.length === 0) return null;
  if (!hash.startsWith(PREVIEW_APP_HASH_PREFIX)) return null;
  const raw = hash.slice(PREVIEW_APP_HASH_PREFIX.length);
  if (raw.length === 0) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // Validate against the compiled view so a stale hash never selects a
  // non-existent hub. `compiled.hubs` is already stably ordered by hubId
  // (SC-053), so a linear scan is fine — multi-hub apps are small.
  for (const entry of compiled.hubs) {
    if (entry.hubId === decoded) return decoded;
  }
  return null;
}

/** Resolve the active hub id from a hash, falling back to the first compiled
 *  hub when the hash is missing or invalid. Returns `null` only when the
 *  compiled view contains no hubs (the empty-app edge case). */
export function resolveActiveHubId(
  hash: string,
  compiled: CompiledAppView,
): string | null {
  const fromHash = parsePreviewAppHash(hash, compiled);
  if (fromHash !== null) return fromHash;
  return compiled.hubs.length > 0 ? compiled.hubs[0].hubId : null;
}

/** Next hub in compiled order, wrapping from last to first. Returns `null`
 *  when `currentHubId` is not in the compiled view, so callers can detect a
 *  stale current selection rather than silently wrapping to an unrelated hub. */
export function getNextHubId(
  compiled: CompiledAppView,
  currentHubId: string,
): string | null {
  const idx = compiled.hubs.findIndex((h) => h.hubId === currentHubId);
  if (idx < 0) return null;
  const next = compiled.hubs[(idx + 1) % compiled.hubs.length];
  return next.hubId;
}

/** Previous hub in compiled order, wrapping from first to last. Returns `null`
 *  for an unknown `currentHubId` for the same reason as `getNextHubId`. */
export function getPrevHubId(
  compiled: CompiledAppView,
  currentHubId: string,
): string | null {
  const idx = compiled.hubs.findIndex((h) => h.hubId === currentHubId);
  if (idx < 0) return null;
  const len = compiled.hubs.length;
  const prev = compiled.hubs[(idx - 1 + len) % len];
  return prev.hubId;
}

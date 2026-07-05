// PRISM SHELL — CURATED HEAD CATALOG (SHELL W3, decision C — head catalog)
//
// The config-driven curated head: ~12 one-click tiles across
// payments / comms / data / social (spec §12 W3 task 3). This is the SINGLE
// source both the Integrations surface AND the W2 intake connect card bind to
// (task 6 — intake tiles bind to this catalog contract). Adding a head tile is
// a one-line edit here; the long tail is reached by the "connect anything"
// search → agent-authored-connector request path (decision C rider), never by
// growing this list unboundedly.
//
// Every `brandMark` resolves to a REAL provider glyph or branded monogram via
// lib/capabilities/brand-assets (no stock icons, no fake logos). `authMethods`
// declares which managed methods the platform supports (C2); the shell offers
// them in the white-label Connect UI. NO secret material lives here — these are
// public platform facts.

import type { CatalogTile } from '../../../../packages/shared-interfaces/src/prism-integrations';

/** The curated head — 12 tiles, four buckets. Ordered payments → comms → data
 *  → social so the surface reads in that rhythm. */
export const INTEGRATION_CATALOG: readonly CatalogTile[] = [
  // ── Payments ───────────────────────────────────────────────────────────────
  { providerId: 'stripe', label: 'Stripe', brandMark: 'stripe', category: 'Payments', hint: 'Subscriptions & checkout', authMethods: ['oauth2.1', 'api-token'] },
  { providerId: 'shopify', label: 'Shopify', brandMark: 'shopify', category: 'Payments', hint: 'Storefront & orders', authMethods: ['oauth2.1'] },
  // ── Comms ──────────────────────────────────────────────────────────────────
  { providerId: 'slack', label: 'Slack', brandMark: 'slack', category: 'Comms', hint: 'Notifications & bots', authMethods: ['oauth2.1'] },
  { providerId: 'resend', label: 'Resend', brandMark: 'resend', category: 'Comms', hint: 'Transactional email', authMethods: ['api-token'] },
  { providerId: 'twilio', label: 'Twilio', brandMark: 'twilio', category: 'Comms', hint: 'SMS & voice', authMethods: ['api-token'] },
  { providerId: 'sendgrid', label: 'SendGrid', brandMark: 'sendgrid', category: 'Comms', hint: 'Email delivery', authMethods: ['api-token'] },
  // ── Data ───────────────────────────────────────────────────────────────────
  { providerId: 'supabase', label: 'Supabase', brandMark: 'supabase', category: 'Data', hint: 'Postgres + auth', authMethods: ['oauth2.1', 'api-token'] },
  { providerId: 'airtable', label: 'Airtable', brandMark: 'airtable', category: 'Data', hint: 'Spreadsheet database', authMethods: ['oauth2.1', 'api-token'] },
  { providerId: 'postgres', label: 'Postgres', brandMark: 'postgres', category: 'Data', hint: 'Managed SQL', authMethods: ['api-token'] },
  { providerId: 'notion', label: 'Notion', brandMark: 'notion', category: 'Data', hint: 'Docs & databases', authMethods: ['oauth2.1'] },
  // ── Social ─────────────────────────────────────────────────────────────────
  { providerId: 'x', label: 'X', brandMark: 'x', category: 'Social', hint: 'Post & read timelines', authMethods: ['oauth2.1'] },
  { providerId: 'discord', label: 'Discord', brandMark: 'discord', category: 'Social', hint: 'Community & webhooks', authMethods: ['oauth2.1'] },
  // ── Analytics (E17 completeness scan target) ─────────────────────────────────
  { providerId: 'posthog', label: 'PostHog', brandMark: 'posthog', category: 'Analytics', hint: 'Product analytics & events', authMethods: ['api-token'] },
] as const;

export const CATALOG_BY_ID = new Map(
  INTEGRATION_CATALOG.map((t) => [t.providerId, t]),
);

/** The head subset the W2 intake connect card shows (task 6 — one voice, one
 *  source). Six representative platforms drawn straight from the catalog. */
export const INTAKE_HEAD_PROVIDER_IDS = [
  'stripe',
  'supabase',
  'slack',
  'resend',
  'airtable',
  'notion',
] as const;

/** The catalog tiles the intake card renders (derived — never a parallel list). */
export function intakeHeadTiles(): CatalogTile[] {
  return INTAKE_HEAD_PROVIDER_IDS.map((id) => CATALOG_BY_ID.get(id)).filter(
    (t): t is CatalogTile => Boolean(t),
  );
}

/** The distinct category buckets, in catalog order. */
export function catalogCategories(): string[] {
  const seen: string[] = [];
  for (const t of INTEGRATION_CATALOG) {
    if (!seen.includes(t.category)) seen.push(t.category);
  }
  return seen;
}

/** Rank a query against a tile (exact > prefix > substring across label,
 *  providerId, category, hint). 0 = no match. Shared by client preview + the
 *  server search procedure so hit/miss is consistent on both sides. */
export function scoreTile(query: string, tile: CatalogTile): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  const fields = [tile.label, tile.providerId, tile.category, tile.hint ?? ''];
  let best = 0;
  for (const f of fields) {
    const h = f.toLowerCase();
    if (h === needle) best = Math.max(best, 4);
    else if (h.startsWith(needle)) best = Math.max(best, 3);
    else if (h.includes(needle)) best = Math.max(best, 2);
  }
  return best;
}

/** Search the curated head. Returns ranked hits (may be empty → the caller
 *  offers the connector request path, decision C rider). */
export function searchCatalog(query: string, limit = 24): CatalogTile[] {
  return INTEGRATION_CATALOG.map((tile) => ({ tile, s: scoreTile(query, tile) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.tile);
}

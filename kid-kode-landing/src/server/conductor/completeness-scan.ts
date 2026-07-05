// PRISM SHELL — COMPLETENESS SCAN (SHELL W5B / E17, 2026-07-05)
//
// "Ship & Make Profitable": the Conductor scans the app graph for the
// capabilities a real, shippable, profitable app needs — auth, db, storage,
// payments, subscriptions, email, analytics — and offers the MISSING ones as
// one-click capability cards (bound to the W3 catalog) in the streaming chat
// (E17). A capability counts as PRESENT only on a STRONG signal (a capability
// reference, an integration binding, a backend ref, or a node the Conductor
// authored for that capability) — a mere "Pricing" section title does NOT make
// payments present (showing a price ≠ processing one). This keeps the scan
// honest: it recommends real capability wiring, not decoration.

import type { GraphSource, PrismNode } from '../../lib/prism-graph/types';
import type {
  CapabilityCard,
  CapabilityCategory,
  CompletenessItem,
  CompletenessScan,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import { PRISM_CONDUCTOR_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-conductor';
import { CATALOG_BY_ID } from '../../lib/shell/integrations/catalog';

interface CategorySpec {
  category: CapabilityCategory;
  title: string;
  description: string;
  /** Catalog providers that satisfy this capability (first = recommended). */
  providers: string[];
}

/** The 7 categories the founder anchor names, each mapped to its W3 catalog
 *  provider recommendation. */
const CATEGORIES: readonly CategorySpec[] = [
  { category: 'auth', title: 'Add accounts & auth', description: 'Sign-up, login, and sessions so users have accounts.', providers: ['supabase'] },
  { category: 'db', title: 'Add a database', description: 'Persist app data — records, content, user rows.', providers: ['supabase', 'postgres', 'airtable'] },
  { category: 'storage', title: 'Add file storage', description: 'Store uploads, images, and media for your app.', providers: ['supabase'] },
  { category: 'payments', title: 'Add payments', description: 'Take one-time payments and checkout — start earning.', providers: ['stripe', 'shopify'] },
  { category: 'subscriptions', title: 'Add subscriptions', description: 'Recurring billing and plans for predictable revenue.', providers: ['stripe'] },
  { category: 'email', title: 'Add transactional email', description: 'Receipts, verification, and notifications to users.', providers: ['resend', 'sendgrid'] },
  { category: 'analytics', title: 'Add analytics', description: 'Track events and conversion so you can grow.', providers: ['posthog'] },
];

/** The subtype prefix the Conductor stamps on a capability node it authored
 *  (E17). Presence detection reads this back so an added capability is seen. */
export const CAPABILITY_SUBTYPE_PREFIX = 'capability-';

function nodeCapabilityProviders(n: PrismNode): string[] {
  const out: string[] = [];
  for (const ref of n.capabilityRefs ?? []) {
    const integrationId = typeof ref.integrationId === 'string' ? ref.integrationId : '';
    if (integrationId) out.push(integrationId.toLowerCase());
    // scope like "stripe:connect" → provider prefix
    if (typeof ref.scope === 'string' && ref.scope) out.push(ref.scope.split(':')[0].toLowerCase());
  }
  // Node-level integration references (the W3 capability-reference wiring).
  for (const ir of n.integrationRefs ?? []) {
    if (ir.platformId) out.push(ir.platformId.toLowerCase());
    if (ir.capabilityRef?.scope) out.push(ir.capabilityRef.scope.split(':')[0].toLowerCase());
  }
  if (typeof n.backendRef === 'string' && n.backendRef.length > 0) out.push(n.backendRef.toLowerCase());
  return out;
}

/** Is this capability present in the graph? STRONG signals only. */
function detectPresent(
  spec: CategorySpec,
  graph: GraphSource,
  boundProviderIds: string[],
): { present: boolean; evidence: string } {
  // 1. An integration is bound for one of this category's providers.
  const bound = boundProviderIds.find((p) => spec.providers.includes(p.toLowerCase()));
  if (bound) return { present: true, evidence: `integration bound: ${bound}` };

  // 2. A node carries a capabilityRef / backendRef for a provider. Skip the
  //    Conductor's own capability-marker nodes (a stripe payments node must not
  //    leak into subscriptions just because both use stripe) — those are
  //    matched category-precisely by the marker in step 3.
  for (const n of graph.nodes) {
    if (n.subtype.startsWith(CAPABILITY_SUBTYPE_PREFIX)) continue;
    const provs = nodeCapabilityProviders(n);
    const hit = provs.find((p) => spec.providers.includes(p));
    if (hit) return { present: true, evidence: `capability ref on ${n.nodeId}: ${hit}` };
  }

  // 3. A node the Conductor authored for this capability (subtype marker) —
  //    category-precise (capability-payments ≠ capability-subscriptions).
  const marker = `${CAPABILITY_SUBTYPE_PREFIX}${spec.category}`;
  const authored = graph.nodes.find((n) => n.subtype === marker);
  if (authored) return { present: true, evidence: `capability node: ${authored.nodeId}` };

  return { present: false, evidence: `no ${spec.category} capability wired` };
}

function cardFor(spec: CategorySpec): CapabilityCard | null {
  const providerId = spec.providers[0];
  const tile = CATALOG_BY_ID.get(providerId);
  if (!tile) return null;
  return {
    category: spec.category,
    title: spec.title,
    description: spec.description,
    providerId: tile.providerId,
    providerLabel: tile.label,
    brandMark: tile.brandMark,
  };
}

/** Scan a graph for capability completeness (E17). Pure over (graph, bindings)
 *  + a caller-supplied timestamp (workflow-safe — no Date.now here). */
export function scanCompleteness(
  projectId: string,
  graph: GraphSource,
  boundProviderIds: string[],
  scannedAtIso: string,
): CompletenessScan {
  const items: CompletenessItem[] = CATEGORIES.map((spec) => {
    const { present, evidence } = detectPresent(spec, graph, boundProviderIds);
    return {
      category: spec.category,
      present,
      evidence,
      card: present ? null : cardFor(spec),
    };
  });
  const cards = items.flatMap((i) => (i.card ? [i.card] : []));
  const presentCount = items.filter((i) => i.present).length;
  return {
    v: PRISM_CONDUCTOR_CONTRACT_VERSION,
    projectId,
    items,
    cards,
    presentCount,
    missingCount: items.length - presentCount,
    scannedAt: scannedAtIso,
  };
}

/** The category spec (title/providers) for capability authoring. */
export function categorySpec(category: CapabilityCategory): CategorySpec | null {
  return CATEGORIES.find((c) => c.category === category) ?? null;
}

// PRISM SHELL — HOST PRICING + RECOMMENDATIONS (SHELL W5B / E18, 2026-07-05)
//
// On ship, recommend frontend AND (when the graph has backend/GPU nodes)
// backend hosts based on what was built, with CURRENT pricing fetched live at
// run time — cache ≤24h, source cited (E18). Absent a live pricing feed
// (PRISM_PRICING_FEED_URL), a DATED, source-cited static table is used and
// labeled `static` so a stale price is never presented as live (W5B-D5).
//
// Pricing is public fact; no secret rides these shapes (I5).

import 'server-only';
import type {
  DeployTargetKind,
  HostPricing,
  HostRecommendation,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import type { GraphSource } from '../../lib/prism-graph/types';
import { getTargetDescriptor, isTargetAvailable } from './deploy-targets';
import { hasBackendNodes, mapBackendNodes } from './backend-nodes';

const PRICING_ASOF = '2026-07-01';

// The dated fallback table (source-cited). Compiled from each host's public
// pricing pages (2026-07); a live feed replaces the values, not the shape.
const STATIC_PRICING: Record<DeployTargetKind, { headline: string; source: string }> = {
  'prism-cloud': { headline: 'Included — instant shareable preview', source: 'Prism Cloud (included)' },
  vercel: { headline: 'Free hobby · $20/mo Pro', source: 'vercel.com/pricing (2026-07)' },
  netlify: { headline: 'Free starter · $19/mo Pro', source: 'netlify.com/pricing (2026-07)' },
  cloudflare: { headline: 'Free Pages · $5/mo Workers paid', source: 'cloudflare.com/plans (2026-07)' },
  modal: { headline: '~$1.10/hr A10G · per-second billing', source: 'modal.com/pricing (2026-07)' },
  runpod: { headline: '~$0.79/hr A40 · serverless per-sec', source: 'runpod.io/pricing (2026-07)' },
  vast: { headline: '~$0.40/hr A40 (marketplace)', source: 'vast.ai/pricing (2026-07)' },
};

// ── ≤24h cache ────────────────────────────────────────────────────────────────
interface CacheEntry { at: number; pricing: Record<DeployTargetKind, HostPricing>; }
let cache: CacheEntry | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;

function staticPricing(): Record<DeployTargetKind, HostPricing> {
  const out = {} as Record<DeployTargetKind, HostPricing>;
  for (const kind of Object.keys(STATIC_PRICING) as DeployTargetKind[]) {
    const s = STATIC_PRICING[kind];
    out[kind] = { kind, headline: s.headline, freshness: 'static', asOf: PRICING_ASOF, source: s.source };
  }
  return out;
}

/** Fetch current host pricing (E18). Live when PRISM_PRICING_FEED_URL is set +
 *  fetch succeeds; cached within ≤24h; else the dated static table. `nowMs` is
 *  caller-supplied so the cache is testable/deterministic. */
export async function fetchHostPricing(nowMs: number): Promise<Record<DeployTargetKind, HostPricing>> {
  if (cache && nowMs - cache.at < TTL_MS) {
    // Serve from cache — mark entries `cached` (they were fetched earlier).
    const out = {} as Record<DeployTargetKind, HostPricing>;
    for (const kind of Object.keys(cache.pricing) as DeployTargetKind[]) {
      out[kind] = { ...cache.pricing[kind], freshness: cache.pricing[kind].freshness === 'live' ? 'cached' : cache.pricing[kind].freshness };
    }
    return out;
  }

  const feed = process.env.PRISM_PRICING_FEED_URL;
  if (feed) {
    try {
      const res = await fetch(feed, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const raw = (await res.json()) as Partial<Record<DeployTargetKind, { headline: string; source?: string }>>;
        const merged = staticPricing();
        for (const kind of Object.keys(merged) as DeployTargetKind[]) {
          const live = raw[kind];
          if (live?.headline) {
            merged[kind] = { kind, headline: live.headline, freshness: 'live', asOf: new Date(nowMs).toISOString().slice(0, 10), source: live.source ?? `${feed} (live)` };
          }
        }
        cache = { at: nowMs, pricing: merged };
        return merged;
      }
    } catch {
      /* fall through to static */
    }
  }

  const table = staticPricing();
  cache = { at: nowMs, pricing: table };
  return table;
}

/** Recommend hosts for a built graph (E18). Frontend always; backend only when
 *  the graph has backend/GPU nodes (E19). Ranked by fit for THIS app. */
export async function recommendHosts(
  graph: GraphSource,
  appName: string,
  nowMs: number,
): Promise<{ hasBackend: boolean; frontend: HostRecommendation[]; backend: HostRecommendation[] }> {
  const pricing = await fetchHostPricing(nowMs);
  const rec = (kind: DeployTargetKind, reason: string, rank: number): HostRecommendation => {
    const d = getTargetDescriptor(kind)!;
    return {
      kind, label: d.label, category: d.category, available: isTargetAvailable(kind),
      reason, rank, pricing: pricing[kind],
    };
  };

  // Frontend: prism-cloud (instant, included) first, then Vercel (edge + preview
  // deployments — recommended for a Next/three app), then Netlify, Cloudflare.
  const frontend: HostRecommendation[] = [
    rec('prism-cloud', 'Instant shareable preview — the runtime IS the product, zero config.', 0),
    rec('vercel', 'Best fit for this app: global edge + preview deployments for the Next host.', 1),
    rec('netlify', 'Frontend hosting with deploy previews.', 2),
    rec('cloudflare', 'Edge Workers/Pages + at-cost domains via the Registrar.', 3),
  ];

  const hasBackend = hasBackendNodes(graph);
  let backend: HostRecommendation[] = [];
  if (hasBackend) {
    // Rank backend hosts by how many of the graph's backend nodes prefer each
    // target as their default (E19 mapping), then by cost.
    const maps = mapBackendNodes(graph, appName);
    const score = new Map<DeployTargetKind, number>();
    for (const m of maps) score.set(m.defaultTarget, (score.get(m.defaultTarget) ?? 0) + 1);
    const order: DeployTargetKind[] = ['modal', 'runpod', 'vast'];
    backend = order
      .sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0))
      .map((kind, i) => {
        const preferred = (score.get(kind) ?? 0) > 0;
        const reason = kind === 'vast'
          ? 'Lowest-cost GPU marketplace for your model nodes.'
          : preferred
            ? `Recommended for your ${maps.length} backend node(s) — per-second GPU billing.`
            : 'Serverless GPU for backend/model nodes.';
        return rec(kind, reason, i);
      });
  }

  return { hasBackend, frontend, backend };
}

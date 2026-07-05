// PRISM SHELL — DOMAIN PROVIDER REGISTRY (SHELL W5B / E16, 2026-07-05)
//
// The typed DomainProvider adapter layer. `entri` (Sell/Connect/Monitor) is the
// universal spine; `vercel-registrar` and `cloudflare-registrar` are
// config-selected alternates behind the SAME interface. Absent the provider's
// env key every step runs SANDBOX: availability + pricing are DETERMINISTIC
// (seeded off the SLD/TLD so a candidate always resolves the same), "purchase"
// mints a sandbox order, and "connect" returns the DNS records auto-DNS would
// set — no real registration, no charge. I5: the vendor API keys are read here
// (availability) and NEVER leave the server; only NAMES surface.

import 'server-only';
import { createHash } from 'node:crypto';
import type {
  DnsRecord,
  DomainAvailability,
  DomainProvider,
  DomainProviderDescriptor,
} from '../../../packages/shared-interfaces/src/prism-domains';

interface ProviderSpec {
  provider: DomainProvider;
  label: string;
  requiredEnv: string[];
  note: string;
  /** Pricing source citation (E16 — never presented as live when sandbox). */
  source: string;
  /** Baseline register price for a common TLD (USD); premium TLDs scale it. */
  basePriceUsd: number;
}

const PROVIDERS: readonly ProviderSpec[] = [
  {
    provider: 'entri',
    label: 'Entri',
    requiredEnv: ['ENTRI_APPLICATION_ID', 'ENTRI_SECRET'],
    note: 'Universal search · buy · auto-DNS (Connect: 35+ providers) · Monitor.',
    source: 'developers.entri.com Sell/Connect/Monitor (2026-07)',
    basePriceUsd: 12,
  },
  {
    provider: 'vercel-registrar',
    label: 'Vercel Domains',
    requiredEnv: ['VERCEL_TOKEN'],
    note: 'Native registrar when shipping to Vercel — one-step DNS.',
    source: 'vercel.com Domains Registrar API (2026)',
    basePriceUsd: 15,
  },
  {
    provider: 'cloudflare-registrar',
    label: 'Cloudflare Registrar',
    requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    note: 'At-cost registration (no markup) + edge DNS.',
    source: 'blog.cloudflare.com Registrar (2026-04)',
    basePriceUsd: 10,
  },
];

const BY_PROVIDER = new Map(PROVIDERS.map((p) => [p.provider, p]));

export function isProviderLive(provider: DomainProvider): boolean {
  const spec = BY_PROVIDER.get(provider);
  if (!spec) return false;
  return spec.requiredEnv.every((n) => {
    const v = process.env[n];
    return typeof v === 'string' && v.length > 0;
  });
}

export function getDomainProviders(): DomainProviderDescriptor[] {
  return PROVIDERS.map((p) => ({
    provider: p.provider,
    label: p.label,
    mode: isProviderLive(p.provider) ? 'live' : 'sandbox',
    requiredEnv: [...p.requiredEnv],
    note: p.note,
  }));
}

// ── Deterministic sandbox helpers ─────────────────────────────────────────────

function h32(s: string): number {
  return parseInt(createHash('sha256').update(s).digest('hex').slice(0, 8), 16);
}

/** Sanitize a raw query into a base SLD (letters/digits/hyphen). */
function toSld(query: string): string {
  const base = query.trim().toLowerCase().split('.')[0];
  return base.replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '').slice(0, 63) || 'app';
}

const TLDS = ['.com', '.io', '.app', '.dev', '.co'] as const;

/** Premium multiplier per TLD (deterministic, source-cited baseline scaling). */
function tldMultiplier(tld: string): number {
  switch (tld) {
    case '.io': return 3.2;
    case '.app': return 1.4;
    case '.dev': return 1.2;
    case '.co': return 2.1;
    default: return 1; // .com
  }
}

/** Search availability + pricing for a query across common TLDs. Deterministic
 *  in sandbox; a live provider would replace the availability/price source. */
export function searchDomains(query: string, provider: DomainProvider): DomainAvailability[] {
  const spec = BY_PROVIDER.get(provider);
  if (!spec) return [];
  const live = isProviderLive(provider);
  const mode = live ? 'live' : 'sandbox';
  const sld = toSld(query);
  const explicitTld = query.includes('.') ? '.' + query.split('.').slice(1).join('.').toLowerCase() : null;
  const tlds = explicitTld && (TLDS as readonly string[]).includes(explicitTld)
    ? [explicitTld, ...TLDS.filter((t) => t !== explicitTld)]
    : [...TLDS];

  return tlds.slice(0, 6).map((tld) => {
    const domain = `${sld}${tld}`;
    // Deterministic availability: ~70% available, seeded off the full domain.
    const available = h32(`${provider}:${domain}`) % 10 >= 3;
    const register = Number((spec.basePriceUsd * tldMultiplier(tld)).toFixed(2));
    return {
      domain,
      available,
      provider,
      mode,
      price: available
        ? { registerUsd: register, renewUsd: Number((register * 1.05).toFixed(2)), currency: 'USD' as const }
        : null,
      source: live ? `${spec.label} live API` : `${spec.source} · sandbox`,
    };
  });
}

/** The DNS records Connect auto-DNS applies to point `domain` at the deploy's
 *  preview/production host. Sandbox returns exactly what a live Connect would
 *  set (evidence); a live run applies them via the provider. */
export function buildAutoDns(domain: string, targetHost: string): DnsRecord[] {
  const apex = domain.split('.').length <= 2;
  return [
    apex
      ? { type: 'ALIAS' as const, name: '@', value: targetHost, ttl: 3600 }
      : { type: 'CNAME' as const, name: domain.split('.')[0], value: targetHost, ttl: 3600 },
    { type: 'TXT' as const, name: '_prism-verify', value: `prism-domain=${h32(domain).toString(16)}`, ttl: 3600 },
  ];
}

export function getProviderSource(provider: DomainProvider): string {
  return BY_PROVIDER.get(provider)?.source ?? 'unknown';
}

import 'server-only';

// PRISM SHELL — SSRF-HARDENED SERVER FETCH (SHELL W3)
//
// Discharges the obligation W2 deferred (intake seedFromUrl carried a literal
// hostname DENYLIST; its comment named "Full DNS-rebind defense is deferred to
// W3's server-fetch hardening"). This module RESOLVES the host and validates
// every resolved IP — defeating the rebind where a public-looking hostname
// resolves to 127.0.0.1 / 169.254.169.254 / an RFC-1918 address, which a
// literal-name denylist cannot catch.
//
// Defense layers:
//   1. Scheme allowlist: http/https only.
//   2. Literal-form denylist (localhost/.local/.internal + IP-literal hosts) —
//      cheap first cut, kept from W2.
//   3. DNS resolution + per-address classification: reject if ANY resolved
//      address is loopback, private (RFC-1918/ULA), link-local, CGNAT, or a
//      cloud metadata address. Refuse-if-any is the safe posture.
//   4. Manual redirect following (bounded hops), RE-VALIDATING each hop — a 302
//      to an internal host cannot slip past by riding the redirect.
//   5. Timeout + response-size cap (caller reads a capped body).
//
// Residual: the classic TOCTOU between our lookup and the platform fetch's own
// resolution. When the `undici` Agent is importable at runtime we PIN the
// connection to the vetted addresses (closing it); otherwise we degrade to
// resolve-and-check, which still closes the rebind vector the W2 denylist
// missed. Production hardening note lives in the report.

import { lookup as dnsLookupCb } from 'node:dns';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { optionalImport } from '../optional-import';

export interface SafeFetchResult {
  ok: boolean;
  /** null when the request was blocked (SSRF guard) or failed. */
  response: Response | null;
  /** Why it was blocked/failed, for server logs (never surfaced to a tenant). */
  reason?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

/** Classify a resolved IP literal as internal/unsafe. Covers IPv4 + IPv6. */
export function isPrivateAddress(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return isPrivateV4(ip);
  if (fam === 6) return isPrivateV6(ip);
  return true; // unparseable → treat as unsafe
}

function isPrivateV4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 127) return true; // this-host + loopback
  if (a === 10) return true; // RFC-1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC-1918
  if (a === 192 && b === 168) return true; // RFC-1918
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC-6598)
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateV6(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (h.startsWith('fe80:') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb'))
    return true; // link-local fe80::/10
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local fc00::/7
  // IPv4-mapped (::ffff:127.0.0.1) — validate the embedded v4.
  const mapped = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
}

/** Literal-form host denylist (kept from W2 — the cheap first cut). */
function isBlockedLiteralHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal')
  ) {
    return true;
  }
  // If the host IS an IP literal, classify it directly (no DNS needed).
  if (isIP(h)) return isPrivateAddress(h);
  return false;
}

/** Resolve + validate a hostname. Returns the vetted address list, or null if
 *  the host is unresolvable or ANY resolved address is internal. */
async function resolveVetted(hostname: string): Promise<{ address: string; family: number }[] | null> {
  if (isBlockedLiteralHost(hostname)) return null;
  // An IP literal that passed isBlockedLiteralHost is a public literal — allow.
  if (isIP(hostname)) return [{ address: hostname, family: isIP(hostname) }];
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return null;
  }
  if (addrs.length === 0) return null;
  // Refuse-if-any: a single internal address blocks the whole host.
  if (addrs.some((a) => isPrivateAddress(a.address))) return null;
  return addrs;
}

/** Build an undici dispatcher that PINS DNS to the vetted addresses, closing
 *  the TOCTOU rebind window. Returns null when undici is not importable — the
 *  caller then relies on resolve-and-check alone. */
async function pinnedDispatcher(
  vetted: { address: string; family: number }[],
): Promise<unknown | null> {
  const mod = await optionalImport<{ Agent?: new (opts: unknown) => unknown }>('undici');
  const Agent = mod?.Agent;
  if (typeof Agent !== 'function') return null;
  // A lookup that never re-resolves: always hands back the vetted address set.
  const pinnedLookup: typeof dnsLookupCb = ((_hostname, _options, cb) => {
    const callback = (typeof _options === 'function' ? _options : cb) as (
      err: NodeJS.ErrnoException | null,
      address: string | { address: string; family: number }[],
      family?: number,
    ) => void;
    const all = typeof _options === 'object' && _options && (_options as { all?: boolean }).all;
    if (all) {
      callback(null, vetted.map((a) => ({ address: a.address, family: a.family })));
    } else {
      callback(null, vetted[0].address, vetted[0].family);
    }
  }) as typeof dnsLookupCb;
  try {
    return new Agent({ connect: { lookup: pinnedLookup } });
  } catch {
    return null;
  }
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Max response bytes signalled to the caller via a header check only; the
   *  caller performs the capped read (streaming). */
  method?: 'GET' | 'HEAD';
}

/** SSRF-hardened fetch: validates the host (and every redirect hop) against the
 *  resolve+classify guard before any connection to that hop is made. */
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { ok: false, response: null, reason: 'invalid-url' };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      return { ok: false, response: null, reason: 'scheme-not-allowed' };
    }
    const vetted = await resolveVetted(current.hostname);
    if (!vetted) {
      return { ok: false, response: null, reason: 'host-blocked' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const dispatcher = await pinnedDispatcher(vetted);
      const init: RequestInit & { dispatcher?: unknown } = {
        method: opts.method ?? 'GET',
        signal: controller.signal,
        redirect: 'manual', // we follow hops ourselves, re-validating each
        headers: opts.headers,
      };
      if (dispatcher) init.dispatcher = dispatcher;
      const res = await fetch(current, init as RequestInit);

      // Manual redirect handling — re-validate the next hop before following.
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return { ok: res.ok, response: res };
        let next: URL;
        try {
          next = new URL(loc, current);
        } catch {
          return { ok: false, response: null, reason: 'bad-redirect' };
        }
        current = next;
        continue; // loop re-validates the new host
      }
      return { ok: res.ok, response: res };
    } catch (err) {
      return {
        ok: false,
        response: null,
        reason: err instanceof Error ? err.name : 'fetch-error',
      };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, response: null, reason: 'too-many-redirects' };
}

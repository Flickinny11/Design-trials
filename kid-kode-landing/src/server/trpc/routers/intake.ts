// PRISM SHELL — INTAKE ROUTER (SHELL W2 — Guided Build / Intake)
//
// The intake-concern tRPC surface (spec §3, S5). Two procedures:
//   - seedFromUrl: E3 "paste a URL seeds the Brand Profile", implemented as a
//     user-initiated, SERVER-SIDE metadata read (W2-D3) — timeout- and
//     size-capped; extracts only <title>, og:site_name, theme-color, an icon
//     href, and og:description. Nothing is persisted; the client folds the
//     hints into its working Brand Profile. Runtime no-remote-asset law
//     (VERIFICATION-STANDARD §8) is about the app's BROWSER asset loading —
//     this is a server fetch the user explicitly asked for.
//   - finalize: an approved Build Brief becomes a real tenant project and the
//     builder is handed the project in `plan-pending` (W2-D4). Contract-first,
//     protected, owner-derived-from-session (I11).

import 'server-only';
import { TRPCError } from '@trpc/server';
import {
  intakeFinalizeInputSchema,
  intakeGetBriefInputSchema,
  intakeSeedFromUrlInputSchema,
  intakeUrlSeedSchema,
  type IntakeFinalizeOutput,
  type IntakeUrlSeed,
} from '../../../../packages/shared-interfaces/src/prism-intake';
import { PRISM_TENANCY_CONTRACT_VERSION } from '../../../../packages/shared-interfaces/src/prism-tenancy';
import * as store from '../../tenancy/tenant-store';
import { safeFetch } from '../../net/safe-fetch';
import { protectedProcedure, router } from '../init';

/** Read caps for the URL seed fetch (W2-D3). */
const URL_SEED_TIMEOUT_MS = 5000;
const URL_SEED_MAX_BYTES = 512 * 1024; // read at most 512 KB of <head>

// SSRF defense: the W2 literal-hostname denylist is SUPERSEDED by
// src/server/net/safe-fetch.ts, which RESOLVES the host and rejects any host
// that resolves to a loopback / RFC-1918 / link-local / metadata address, and
// re-validates every redirect hop (W3 server-fetch hardening — the DNS-rebind
// defense the W2 comment deferred to this wave).

/** Normalize a CSS colour string the page declared as theme-color to #rrggbb,
 *  or null if it isn't a plain hex (we don't seed from rgb()/named colours). */
function normalizeHex(input: string | null): string | null {
  if (!input) return null;
  const v = input.trim();
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v);
  return m ? v.toLowerCase() : null;
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

/** Read one <meta> content value, tolerant of attribute order (name/property
 *  before OR after content — sites use both). */
function metaContent(html: string, keyAttr: 'name' | 'property', key: string): string | null {
  const k = key.replace(/[:]/g, '\\$&');
  const before = new RegExp(`<meta[^>]+${keyAttr}=["']${k}["'][^>]+content=["']([^"']{1,600})["']`, 'i');
  const after = new RegExp(`<meta[^>]+content=["']([^"']{1,600})["'][^>]+${keyAttr}=["']${k}["']`, 'i');
  return firstMatch(html, before) ?? firstMatch(html, after);
}

function resolveUrl(href: string | null, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString().slice(0, 2048);
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= URL_SEED_MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  }
  return chunks.map((c) => decoder.decode(c, { stream: true })).join('');
}

async function fetchUrlSeed(rawUrl: string): Promise<IntakeUrlSeed> {
  const empty: IntakeUrlSeed = {
    siteName: null,
    title: null,
    themeColor: null,
    iconUrl: null,
    description: null,
  };
  // Only http(s); the Zod .url() already guarantees a URL shape.
  const target = new URL(rawUrl);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return empty;

  try {
    // SSRF-hardened: resolves + validates the host (and every redirect hop)
    // before connecting; pins DNS to the vetted addresses when undici is
    // available (W3 server-fetch hardening).
    const result = await safeFetch(rawUrl, {
      timeoutMs: URL_SEED_TIMEOUT_MS,
      headers: { 'user-agent': 'PrismIntakeBot/1.0 (+brand-seed)' },
    });
    const res = result.response;
    if (!res || !result.ok) return empty;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.includes('html')) return empty;
    const html = await readCapped(res);
    const head = html.slice(0, URL_SEED_MAX_BYTES);

    const title = firstMatch(head, /<title[^>]*>([^<]{1,300})<\/title>/i);
    const siteName =
      metaContent(head, 'property', 'og:site_name') ??
      metaContent(head, 'name', 'application-name');
    const themeColor = normalizeHex(metaContent(head, 'name', 'theme-color'));
    const description =
      metaContent(head, 'name', 'description') ??
      metaContent(head, 'property', 'og:description');
    const iconHref =
      firstMatch(
        head,
        /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']{1,2000})["']/i,
      ) ??
      firstMatch(
        head,
        /<link[^>]+href=["']([^"']{1,2000})["'][^>]+rel=["'][^"']*icon[^"']*["']/i,
      ) ??
      metaContent(head, 'property', 'og:image');

    return intakeUrlSeedSchema.parse({
      siteName: siteName ?? null,
      title: title ?? null,
      themeColor,
      iconUrl: resolveUrl(iconHref, target.toString()),
      description: description ?? null,
    });
  } catch {
    return empty; // unreachable host / timeout / parse — seed nothing
  }
}

export const intakeRouter = router({
  /** E3 — server-side brand-hint read from a pasted URL (W2-D3). */
  seedFromUrl: protectedProcedure
    .input(intakeSeedFromUrlInputSchema)
    .mutation(({ input }) => fetchUrlSeed(input.url)),

  /** Phase 2 — an approved Build Brief becomes a real project in
   *  `plan-pending`, handed off to the builder (spec §3 / W2-D4). */
  finalize: protectedProcedure
    .input(intakeFinalizeInputSchema)
    .mutation(async ({ ctx, input }): Promise<IntakeFinalizeOutput> => {
      const created = await store.createProject(ctx.session.user.id, {
        name: input.brief.title.slice(0, 200),
      });
      const saved = await store.saveBrief(
        ctx.session.user.id,
        created.id,
        input.brief,
      );
      if (!saved) {
        // Created a moment ago under this same session — a miss here is a
        // server fault, not a tenancy boundary.
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Brief could not be persisted to the new project.',
        });
      }
      return { v: PRISM_TENANCY_CONTRACT_VERSION, project: saved.project };
    }),

  /** Read an approved brief (builder plan-pending banner / resume). */
  getBrief: protectedProcedure
    .input(intakeGetBriefInputSchema)
    .query(({ ctx, input }) =>
      store.getBrief(ctx.session.user.id, input.projectId),
    ),
});

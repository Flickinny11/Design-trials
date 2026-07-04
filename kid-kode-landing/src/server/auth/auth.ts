// PRISM SHELL — BETTER AUTH INSTANCE (SHELL W1A, 2026-07-04)
//
// The ONE auth system (spec I2 — Better Auth only, sameSite:'lax', no second
// auth system, ever). Server-only: OAuth client secrets and the session
// signing secret live exclusively in this process (I5).
//
// Providers (spec §14 W1A + founder scope clarification 2026-07-04):
//   • Google one-click  — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
//   • GitHub one-click  — GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
//   • email/password    — always on; the dev/proof path (W1A-D3) and the
//     honest fallback for users who want neither provider.
// Each social provider mounts only when BOTH of its env vars exist, so the
// sign-in surface can show true availability instead of a dead button
// (never presented as available when it isn't — the 7.1 discipline).
//
// Storage (W1A-D1, docs/spec-deviations-prism.md): Node 22's built-in
// node:sqlite at .data/auth.sqlite — the repo's established local-store
// precedent (snippets/store.ts). Production swap is config-only: hand
// Better Auth a Postgres/Supabase connection through this same `database:`
// option. Schema migrations run programmatically at first touch (Kysely
// built-in adapter), so dev and the CI isolation probe self-provision.
//
// E6 plan-tier stub: `planTier` rides the Better Auth user row as an
// additional field with input:false — a signup request can NEVER claim a
// paid tier; billing integration flips it server-side later.

import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { PRISM_DEFAULT_PLAN_TIER } from '../../../packages/shared-interfaces/src/prism-tenancy';

function authDbPath(): string {
  // PRISM_AUTH_DB override keeps the isolation probe hermetic (its own
  // throwaway database, same code path).
  const p =
    process.env.PRISM_AUTH_DB ?? path.join(process.cwd(), '.data', 'auth.sqlite');
  mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

function envPair(id: string | undefined, secret: string | undefined) {
  return id && secret ? { clientId: id, clientSecret: secret } : null;
}

const google = envPair(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
const github = envPair(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET);

export const auth = betterAuth({
  // Absent in dev, Better Auth infers the origin from the request; the
  // founder sets BETTER_AUTH_URL (+ per-provider callback URLs) in prod.
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new DatabaseSync(authDbPath()),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    ...(google ? { google } : {}),
    ...(github ? { github } : {}),
  },
  user: {
    additionalFields: {
      planTier: {
        type: 'string',
        defaultValue: PRISM_DEFAULT_PLAN_TIER,
        // input:false — the tier is never client-assignable (E6: billing
        // flips it server-side in the testing phase).
        input: false,
      },
    },
  },
  advanced: {
    // I2 verbatim: sameSite 'lax'. This IS Better Auth's default; pinned
    // here so the invariant is encoded in config, not in a default we
    // happen to inherit.
    defaultCookieAttributes: {
      sameSite: 'lax',
    },
  },
});

/** Which one-click providers are actually configured — the sign-in surface
 *  renders availability from THIS, so a missing OAuth app shows as
 *  "awaiting credentials", never as a dead working button. */
export function configuredSocialProviders(): { google: boolean; github: boolean } {
  return { google: google !== null, github: github !== null };
}

// ── Schema self-provisioning ────────────────────────────────────────────────
// Programmatic migration (Better Auth's documented Kysely path) instead of a
// CLI step, so `next dev`, `next start`, and the CI isolation probe all
// self-provision an empty database. Runs once per process, idempotent
// against an already-migrated file.
let migrated: Promise<void> | null = null;

export function ensureAuthSchema(): Promise<void> {
  if (!migrated) {
    migrated = getMigrations(auth.options).then(({ runMigrations }) =>
      runMigrations(),
    );
  }
  return migrated;
}

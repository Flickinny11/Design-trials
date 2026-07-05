// PRISM SHELL — COLLAB HOST AUTH BRIDGE (SHELL W7, deviation W7-D1)
//
// The standalone CollabRoom host (a separate Node process) needs to know WHO a
// WebSocket connection belongs to before it may join a room. It resolves the
// Better Auth session by READING Better Auth's own sqlite (the same
// .data/auth.sqlite the Next process owns) — never a second auth system (I2),
// never a client-supplied identity. Read-only.
//
// In production the Cloudflare DO validates the session at the edge via Better
// Auth's server API instead; this direct read is a LOCAL-HOST convenience so
// the channel is verifiable under `next dev`. Documented in the report.
//
// Portable: no `server-only` shim (the host is not an RSC context).

import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface HostSessionUser {
  id: string;
  name: string;
  email: string;
  planTier: string;
}

function authDbPath(): string {
  return (
    process.env.PRISM_AUTH_DB ?? path.join(process.cwd(), '.data', 'auth.sqlite')
  );
}

let db: DatabaseSync | null = null;
function open(): DatabaseSync {
  if (!db) {
    // Read-only handle: the host never writes, and a read-only open avoids
    // contending with the Next process's writer lock. (`readOnly` is a real
    // node:sqlite option; cast past a lagging @types/node.)
    const options = { readOnly: true } as unknown as ConstructorParameters<
      typeof DatabaseSync
    >[1];
    db = new DatabaseSync(authDbPath(), options);
  }
  return db;
}

/** Parse a Cookie header into a map (last value wins, matching browsers). */
function parseCookies(header: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out.set(k, v);
  }
  return out;
}

/** Better Auth's session cookie carries `${token}.${hmac}`; the stored session
 *  row is keyed by the unsigned `token`. Try both the plain and __Secure- name. */
function sessionTokenFromCookies(cookies: Map<string, string>): string | null {
  const raw =
    cookies.get('better-auth.session_token') ??
    cookies.get('__Secure-better-auth.session_token');
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  const token = decoded.split('.')[0];
  return token || null;
}

function notExpired(expiresAt: unknown): boolean {
  if (expiresAt == null) return true;
  const d = new Date(expiresAt as string | number);
  if (Number.isNaN(d.getTime())) return true; // unparseable ⇒ token match is the gate
  return d.getTime() > Date.now();
}

/** Resolve the session user from a raw Cookie header, or null (fail closed). */
export function resolveSessionUser(
  cookieHeader: string | undefined,
): HostSessionUser | null {
  const token = sessionTokenFromCookies(parseCookies(cookieHeader));
  if (!token) return null;
  try {
    const row = open()
      .prepare(
        `SELECT u.id AS id, u.name AS name, u.email AS email,
                u.planTier AS planTier, s.expiresAt AS expiresAt
           FROM session s JOIN user u ON u.id = s.userId
          WHERE s.token = ?`,
      )
      .get(token) as
      | { id: string; name: string; email: string; planTier: string | null; expiresAt: unknown }
      | undefined;
    if (!row || !notExpired(row.expiresAt)) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      planTier: row.planTier ?? 'free',
    };
  } catch {
    // A transient sqlite lock or a missing table ⇒ deny this connection.
    return null;
  }
}

/** Resolve an existing user by email (for org invites), or null. */
export function findUserByEmail(
  email: string,
): { id: string; name: string; email: string } | null {
  try {
    const row = open()
      .prepare(
        `SELECT id, name, email FROM user WHERE email = ? COLLATE NOCASE LIMIT 1`,
      )
      .get(email) as
      | { id: string; name: string; email: string }
      | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

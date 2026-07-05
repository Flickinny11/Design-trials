// PRISM SHELL — PREVIEW TOKEN INDEX (SHELL W5 / E14, 2026-07-04)
//
// A shareable preview URL (E14, Lovable-class) must be openable WITHOUT a
// session — it is a share link. The token IS the capability (I5: a reference,
// not a secret): possessing it grants read of exactly ONE immutable project
// snapshot and nothing else. So the token index is deliberately GLOBAL (not
// tenant-keyed) — it maps an opaque token to a (tenant, project, version)
// pointer — but every resolution reads only that one pinned snapshot via the
// tenant store's isolation-walled `getVersionSnapshot`. No other tenant data
// is reachable with a token; a token cannot be used to enumerate or traverse.
//
// Backing store: server-only JSON under the gitignored .data/, mirroring the
// tenant store's fs precedent. Swap for a KV/DB row behind this same surface.

import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getVersionSnapshot } from '../tenancy/tenant-store';

export interface PreviewPointer {
  tenantId: string;
  projectId: string;
  versionId: string;
  createdAt: string;
}

function tokensRoot(): string {
  return (
    process.env.PRISM_PREVIEW_TOKENS_DIR ??
    path.join(process.cwd(), '.data', 'preview-tokens')
  );
}

/** Tokens are 48-hex opaque strings. The stored FILE is named by the sha256 of
 *  the token so the raw token never becomes a filename (defence in depth). */
const TOKEN_RE = /^[a-f0-9]{48}$/;

function tokenFile(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex');
  return path.join(tokensRoot(), `${digest}.json`);
}

export function mintPreviewToken(): string {
  return randomBytes(24).toString('hex'); // 48 hex chars
}

/** Register a token → snapshot pointer. Idempotent per token. */
export async function registerPreviewToken(
  token: string,
  pointer: PreviewPointer,
): Promise<void> {
  if (!TOKEN_RE.test(token)) throw new Error('preview-tokens: malformed token');
  const file = tokenFile(token);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(pointer, null, 2), 'utf8');
}

export async function resolvePreviewToken(token: string): Promise<PreviewPointer | null> {
  if (!TOKEN_RE.test(token)) return null; // malformed == not found
  try {
    const raw = JSON.parse(await fs.readFile(tokenFile(token), 'utf8')) as PreviewPointer;
    if (!raw || typeof raw.tenantId !== 'string' || typeof raw.projectId !== 'string') return null;
    return raw;
  } catch {
    return null;
  }
}

/** Resolve a preview token straight to the pinned snapshot graph. Returns null
 *  for an unknown/expired token or a missing snapshot — the caller renders a
 *  clean "preview unavailable" state, never leaking whether a project exists. */
export async function readPreviewGraph(
  token: string,
): Promise<{ graph: Record<string, unknown>; pointer: PreviewPointer } | null> {
  const pointer = await resolvePreviewToken(token);
  if (!pointer) return null;
  const graph = await getVersionSnapshot(pointer.tenantId, pointer.projectId, pointer.versionId);
  if (!graph) return null;
  return { graph, pointer };
}

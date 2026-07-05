import 'server-only';

// EB-02-05 — Server-only secrets vault.
//
// Contract (PRISM-EDITOR-BUILD-SPEC.md):
//   - §6 Phase 2 SC-008: store(scope, ref, value), resolve(scope, ref),
//     audit-log table, scoped access; module lives under src/server/secrets/.
//   - §6 Phase 2 SC-011: every resolve call writes an audit entry
//     { at, scope, ref, callerNodeId }.
//   - §7 INV-19: raw secret values never enter the client bundle or the
//     visible graph. Only capability references appear in graph data.
//   - §8 FP-06 / FP-07: gated by `import 'server-only'` on line 1; raw
//     secret literals forbidden in source.
//
// Storage is intentionally in-process: this is the scaffold the editor
// build needs to thread capability refs end-to-end. A production deployment
// swaps the backing store for KV / Postgres / KMS without changing the
// store/resolve/audit surface. Persistence and rotation policy land in a
// later phase; the SC-008 contract only requires the API.

export type VaultScope = string;
export type VaultRef = string;

export interface VaultStoreResult {
  readonly ok: true;
  readonly scope: VaultScope;
  readonly ref: VaultRef;
}

export type VaultResolveResult =
  | {
      readonly ok: true;
      readonly value: string;
      readonly scope: VaultScope;
      readonly ref: VaultRef;
    }
  | {
      readonly ok: false;
      readonly reason: 'not-found' | 'scope-mismatch';
    };

export interface VaultAuditEntry {
  readonly at: string;
  readonly scope: VaultScope;
  readonly ref: VaultRef;
  readonly callerNodeId: string | null;
}

interface VaultEntry {
  scope: VaultScope;
  ref: VaultRef;
  value: string;
}

// Keyed by ref alone so a cross-scope `resolve` can detect the difference
// between "no entry at all" (not-found) and "entry exists but under a
// different scope" (scope-mismatch). Per spec §6 SC-008 scoped access is
// the gate; a strict separation between the two failure modes makes it
// auditable in SC-011.
const entries = new Map<VaultRef, VaultEntry>();
const auditLog: VaultAuditEntry[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export function store(scope: VaultScope, ref: VaultRef, value: string): VaultStoreResult {
  if (!scope || !ref) {
    throw new Error('vault.store requires non-empty scope and ref');
  }
  entries.set(ref, { scope, ref, value });
  return { ok: true, scope, ref };
}

export function resolve(
  scope: VaultScope,
  ref: VaultRef,
  callerNodeId: string | null = null,
): VaultResolveResult {
  const entry = entries.get(ref);

  const auditEntry: VaultAuditEntry = Object.freeze({
    at: nowIso(),
    scope,
    ref,
    callerNodeId: callerNodeId ?? null,
  });
  auditLog.push(auditEntry);

  if (!entry) {
    return { ok: false, reason: 'not-found' };
  }
  if (entry.scope !== scope) {
    return { ok: false, reason: 'scope-mismatch' };
  }
  return { ok: true, value: entry.value, scope: entry.scope, ref: entry.ref };
}

export function audit(): readonly VaultAuditEntry[] {
  // Defensive copy: callers must not be able to mutate the in-process log.
  return Object.freeze(auditLog.slice());
}

export function reset(): void {
  entries.clear();
  auditLog.length = 0;
}

import 'server-only';

// EB-02-05 STUB — implementation lands in the next commit. This stub
// exists only so the failing-test commit type-checks. All call sites
// throw at runtime so the behavior tests fail (TDD requirement).

export type VaultScope = string;
export type VaultRef = string;

export interface VaultStoreResult {
  ok: true;
  scope: VaultScope;
  ref: VaultRef;
}

export type VaultResolveResult =
  | { ok: true; value: string; scope: VaultScope; ref: VaultRef }
  | { ok: false; reason: 'not-found' | 'scope-mismatch' };

export interface VaultAuditEntry {
  at: string;
  scope: VaultScope;
  ref: VaultRef;
  callerNodeId: string | null;
}

export function store(_scope: VaultScope, _ref: VaultRef, _value: string): VaultStoreResult {
  throw new Error('EB-02-05 vault.store not implemented');
}

export function resolve(
  _scope: VaultScope,
  _ref: VaultRef,
  _callerNodeId?: string | null,
): VaultResolveResult {
  throw new Error('EB-02-05 vault.resolve not implemented');
}

export function audit(): readonly VaultAuditEntry[] {
  throw new Error('EB-02-05 vault.audit not implemented');
}

export function reset(): void {
  throw new Error('EB-02-05 vault.reset not implemented');
}

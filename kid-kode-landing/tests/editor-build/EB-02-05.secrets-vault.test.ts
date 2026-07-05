// EB-02-05 — Server-only secrets vault (store + resolve + audit log).
//
// Spec refs:
//   - §6 Phase 2 SC-008 (line 130): "Server-only secrets vault exists at
//     kid-kode-landing/src/server/secrets/ (or via server-only import gate),
//     with: vault.store(scope, ref, value), vault.resolve(scope, ref),
//     audit-log table, scoped access."
//   - §6 Phase 2 SC-011 (line 133): "Vault resolve calls are audited: every
//     call writes to the audit log with { at, scope, ref, callerNodeId }."
//   - §7 INV-19 (line 243): "Raw secret values never enter the client bundle
//     or the visible graph."
//   - §8 FP-06 (line 261): raw secret literals forbidden under src/**.
//   - §8 FP-07 (line 262): process.env.*SECRET access forbidden outside
//     src/server/** or files starting with `import 'server-only'`.
//
// haltCheck (from ralph-state.json): kid-kode-landing/src/server/secrets/vault.ts
// exports store/resolve/audit; first 3 lines import 'server-only'; unit tests
// cover happy path + scope mismatch + audit-log write; no raw secret bytes
// appear in the next/server bundle.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const vaultPath = join(repoRoot, 'src', 'server', 'secrets', 'vault.ts');
const secretsDir = join(repoRoot, 'src', 'server', 'secrets');

describe('EB-02-05 — server-only secrets vault file gates', () => {
  it('SC-008: src/server/secrets/ directory exists', () => {
    expect(existsSync(secretsDir)).toBe(true);
    expect(statSync(secretsDir).isDirectory()).toBe(true);
  });

  it('SC-008: vault.ts exists at the expected path', () => {
    expect(existsSync(vaultPath)).toBe(true);
  });

  it("INV-19 / FP-07: first 3 lines of vault.ts import 'server-only'", () => {
    const src = readFileSync(vaultPath, 'utf8');
    const firstThree = src.split('\n').slice(0, 3).join('\n');
    // Match `import 'server-only';` or `import "server-only";` allowing
    // optional trailing semicolons / whitespace.
    expect(firstThree).toMatch(/import\s+['"]server-only['"];?/);
  });

  it('SC-008: vault.ts exports store, resolve, and audit', () => {
    const src = readFileSync(vaultPath, 'utf8');
    // Each must appear as an `export` declaration (function or const).
    expect(src).toMatch(/export\s+(?:function|const|async\s+function)\s+store\b/);
    expect(src).toMatch(/export\s+(?:function|const|async\s+function)\s+resolve\b/);
    expect(src).toMatch(/export\s+(?:function|const|async\s+function)\s+audit\b/);
  });
});

describe('EB-02-05 — vault behavior contract', () => {
  let vault: typeof import('@/server/secrets/vault');

  beforeEach(async () => {
    // Re-import fresh module per test so the in-memory store + audit log
    // start clean. vitest caches modules; use resetModules-equivalent here.
    const { reset } = await import('@/server/secrets/vault');
    reset();
    vault = await import('@/server/secrets/vault');
  });

  it('happy path: store(scope, ref, value) then resolve(scope, ref) returns the value', () => {
    const stored = vault.store('home-hub', 'fal-api-key', 'sk_secret_value_xxxxxx_long_enough');
    expect(stored.ok).toBe(true);
    expect(stored.scope).toBe('home-hub');
    expect(stored.ref).toBe('fal-api-key');

    const resolved = vault.resolve('home-hub', 'fal-api-key', 'node-1');
    expect(resolved.ok).toBe(true);
    const okResolved = resolved as { ok: true; value: string; scope: string; ref: string };
    expect(okResolved.value).toBe('sk_secret_value_xxxxxx_long_enough');
    expect(okResolved.scope).toBe('home-hub');
    expect(okResolved.ref).toBe('fal-api-key');
  });

  it('scope mismatch: resolve with a different scope than store fails', () => {
    vault.store('home-hub', 'fal-api-key', 'sk_secret_value_xxxxxx_long_enough');
    const resolved = vault.resolve('other-hub', 'fal-api-key', 'node-2');
    expect(resolved.ok).toBe(false);
    expect((resolved as { ok: false; reason: string }).reason).toBe('scope-mismatch');
  });

  it('unknown ref: resolve on a never-stored ref fails with not-found', () => {
    const resolved = vault.resolve('home-hub', 'no-such-ref', 'node-3');
    expect(resolved.ok).toBe(false);
    expect((resolved as { ok: false; reason: string }).reason).toBe('not-found');
  });

  it('SC-011: every resolve call writes an audit entry { at, scope, ref, callerNodeId }', () => {
    vault.store('home-hub', 'fal-api-key', 'sk_value_xxxxxxxxxxxxxxxx_long');
    const beforeCount = vault.audit().length;

    vault.resolve('home-hub', 'fal-api-key', 'node-A');
    vault.resolve('home-hub', 'fal-api-key', 'node-B');
    vault.resolve('home-hub', 'no-such-ref', 'node-C');

    const log = vault.audit();
    expect(log.length).toBe(beforeCount + 3);
    const last3 = log.slice(-3);
    for (const entry of last3) {
      expect(entry).toHaveProperty('at');
      expect(entry).toHaveProperty('scope');
      expect(entry).toHaveProperty('ref');
      expect(entry).toHaveProperty('callerNodeId');
      // ISO-8601 timestamp shape
      expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
    }
    expect(last3.map((e) => e.callerNodeId)).toEqual(['node-A', 'node-B', 'node-C']);
  });

  it('audit log is readonly to callers (return value is a frozen snapshot)', () => {
    vault.store('home-hub', 'fal-api-key', 'sk_value_xxxxxxxxxxxxxxxx_long');
    vault.resolve('home-hub', 'fal-api-key', 'node-1');
    const log = vault.audit();
    // Either the array itself is frozen, OR it is a defensive copy: pushing
    // to the returned slice must not corrupt a subsequent audit() call.
    const sizeBefore = log.length;
    try {
      (log as Array<unknown>).push({ at: 'fake', scope: 'x', ref: 'y', callerNodeId: 'z' });
    } catch {
      // Acceptable: throw is one valid way to enforce read-only.
    }
    const refetched = vault.audit();
    expect(refetched.length).toBe(sizeBefore);
  });

  it('audit entries include both successful and failed resolve calls (every call audited)', () => {
    vault.store('home-hub', 'present-ref', 'sk_value_xxxxxxxxxxxxxxxx_long');
    const start = vault.audit().length;
    vault.resolve('home-hub', 'present-ref', 'node-ok'); // ok
    vault.resolve('home-hub', 'absent-ref', 'node-miss'); // not-found
    vault.resolve('wrong-scope', 'present-ref', 'node-wrong'); // scope-mismatch
    const tail = vault.audit().slice(start);
    expect(tail.map((e) => e.callerNodeId)).toEqual(['node-ok', 'node-miss', 'node-wrong']);
  });
});

describe('EB-02-05 — INV-19 / FP-06 hardening', () => {
  it('FP-06: vault.ts source itself contains no raw secret string literals', () => {
    const src = readFileSync(vaultPath, 'utf8');
    // Same regex used by FP-06 (case-insensitive).
    const fp06 =
      /(api[_-]?key|secret|token|password|client[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/i;
    expect(src).not.toMatch(fp06);
  });

  it('FP-07: vault.ts may access process.env only because it imports server-only', () => {
    const src = readFileSync(vaultPath, 'utf8');
    // If it touches process.env, that is OK *because* of the server-only
    // import on line 1-3. The test just verifies the gate is in place when
    // such access occurs. (If the implementation chooses not to touch
    // process.env at all, this still passes.)
    const touchesEnv = /process\.env\.[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)/.test(src);
    if (touchesEnv) {
      const firstThree = src.split('\n').slice(0, 3).join('\n');
      expect(firstThree).toMatch(/import\s+['"]server-only['"];?/);
    } else {
      expect(true).toBe(true);
    }
  });
});

// EB-02-07 — Client-bundle secret-leak integration test.
//
// Spec refs:
//   - §6 Phase 2 SC-010 (line 132): "Production client bundle contains zero
//     raw secret strings. Verify: grep regex FP-06/FP-07 against
//     kid-kode-landing/.next/static/**/*.js after `next build`."
//   - §6 Phase 2 SC-011 (line 133): "Vault resolve calls are audited: every
//     call writes to the audit log with { at, scope, ref, callerNodeId }.
//     Smoke test asserts an entry per call."
//   - §7 INV-19 (line 243): "Raw secret values never enter the client bundle
//     or the visible graph. Only capability references appear in graph data.
//     Resolution happens server-side via the vault."
//   - §8 FP-06 (line 261): raw secret literals
//     /(api[_-]?key|secret|token|password|client[_-]?secret)\s*[:=]\s*
//     ['"][A-Za-z0-9_\-./+]{16,}['"]/i forbidden under src/**.
//
// haltCheck (from ralph-state.json):
//   "next build emits .next/static; grep over static bundles finds zero raw
//    secret strings; vault audit-log integration test asserts an entry per
//    resolve call."
//
// Strategy:
//   - The companion verificationCommands (in ralph-state.json) run
//     `npm run build` and a shell grep over .next/static for FP-06 hits;
//     those are the authoritative CI gate.
//   - This vitest file is the in-suite mirror of that gate. It (a) walks the
//     existing .next/static tree if present, (b) scans every .js / .css file
//     with the FP-06 regex, and (c) asserts the vault audit-log integration
//     stays in lockstep with SC-011 across the file boundary that ships
//     capability references to the client.
//   - If .next/static is missing, the bundle-scan tests fail loudly with
//     instructions to run `npm run build` — this is the intended failing
//     state pre-implementation (per /ralph-step-editor step 6) and the
//     verificationCommands satisfy it by building before vitest runs.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const nextStaticDir = join(repoRoot, '.next', 'static');

// FP-06 regex, transcribed verbatim from PRISM-EDITOR-BUILD-SPEC.md §8 line
// 261. Case-insensitive per the spec's `(?i)` flag. The pattern catches
// `apiKey: "<32 chars>"`, `secret = '<base64>'`, `client_secret: "<hex>"`,
// etc. — anything that looks like a raw credential literal next to a known
// secret-y identifier. The 16-char minimum on the captured literal avoids
// false positives on short config strings (URLs, hex colors, IDs).
const FP06 =
  /(api[_-]?key|secret|token|password|client[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/i;

// Recursive .js / .css collector under .next/static. Symlinks are not
// expected here; if Next.js changes that, statSync().isDirectory() still
// gates recursion correctly.
function collectBundleFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...collectBundleFiles(p));
    } else if (st.isFile() && (p.endsWith('.js') || p.endsWith('.css'))) {
      out.push(p);
    }
  }
  return out;
}

describe('EB-02-07 — SC-010 / INV-19: client bundle contains zero raw secret strings', () => {
  it('.next/static exists (run `npm run build` first if this fails)', () => {
    // SC-010 explicitly verifies "after `next build`". This test is the
    // boundary check between the verificationCommands' build step and the
    // bundle scan: a missing directory is a fail, not a skip.
    expect(existsSync(nextStaticDir)).toBe(true);
    expect(statSync(nextStaticDir).isDirectory()).toBe(true);
  });

  it('no .next/static/**/*.{js,css} file matches the FP-06 raw-secret regex', () => {
    const files = collectBundleFiles(nextStaticDir);
    // A real production build always emits >0 JS chunks; if the directory is
    // empty the upstream build step silently failed.
    expect(files.length).toBeGreaterThan(0);

    const hits: { file: string; line: number; snippet: string }[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // Per-line scan so failure messages point to a real location instead
      // of dumping a megabyte chunk into the diff.
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(FP06);
        if (m) {
          hits.push({
            file: relative(repoRoot, file),
            line: i + 1,
            // Trim long lines for readability without losing the match
            // itself — keep up to 200 chars around the captured group.
            snippet: lines[i].slice(
              Math.max(0, (m.index ?? 0) - 60),
              Math.min(lines[i].length, (m.index ?? 0) + m[0].length + 60),
            ),
          });
        }
      }
    }

    if (hits.length > 0) {
      const report = hits
        .map((h) => `  ${h.file}:${h.line}\n    ${h.snippet}`)
        .join('\n');
      throw new Error(
        `FP-06 raw-secret literal(s) leaked into .next/static (${hits.length} hit(s)):\n${report}`,
      );
    }
    expect(hits.length).toBe(0);
  });

  it('FP-07: no client-bundle chunk reads process.env.*SECRET / *KEY / *TOKEN / *PASSWORD', () => {
    // SC-010 names FP-06 *and* FP-07 as the regex pair to grep. Server code
    // is fine — but anything Next ships in .next/static is *client* code by
    // definition, so any process.env.*SECRET access there is a leak (the
    // server-only gate FP-07 enforces did not hold).
    const files = collectBundleFiles(nextStaticDir);
    const FP07 = /process\.env\.[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)/;
    const hits: { file: string; match: string }[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const m = src.match(FP07);
      if (m) hits.push({ file: relative(repoRoot, file), match: m[0] });
    }
    if (hits.length > 0) {
      throw new Error(
        `FP-07 violation: process.env.*SECRET/KEY/TOKEN/PASSWORD reachable from client bundle:\n` +
          hits.map((h) => `  ${h.file}: ${h.match}`).join('\n'),
      );
    }
    expect(hits.length).toBe(0);
  });
});

describe('EB-02-07 — SC-011: vault audit log records every resolve() call (integration)', () => {
  let vault: typeof import('@/server/secrets/vault');

  beforeEach(async () => {
    const { reset } = await import('@/server/secrets/vault');
    reset();
    vault = await import('@/server/secrets/vault');
  });

  it('one audit entry per resolve call across happy + not-found + scope-mismatch paths', () => {
    vault.store('home-hub', 'fal-key', 'sk_value_xxxxxxxxxxxxxxxx_long');
    const before = vault.audit().length;

    // Three distinct outcomes, one resolve each. SC-011 is path-independent:
    // every call (ok, not-found, scope-mismatch) writes an entry.
    vault.resolve('home-hub', 'fal-key', 'node-ok');
    vault.resolve('home-hub', 'no-such-ref', 'node-miss');
    vault.resolve('wrong-scope', 'fal-key', 'node-wrong');

    const log = vault.audit();
    expect(log.length).toBe(before + 3);
  });

  it('audit entries carry the SC-011 shape { at, scope, ref, callerNodeId }', () => {
    vault.store('home-hub', 'fal-key', 'sk_value_xxxxxxxxxxxxxxxx_long');
    vault.resolve('home-hub', 'fal-key', 'node-A');
    const [entry] = vault.audit().slice(-1);
    expect(entry).toBeDefined();
    expect(entry).toEqual(
      expect.objectContaining({
        at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
        scope: 'home-hub',
        ref: 'fal-key',
        callerNodeId: 'node-A',
      }),
    );
    // The four fields are exhaustive per SC-011 — extra ad-hoc fields would
    // drift from the spec. Assert the entry has no other own properties.
    expect(Object.keys(entry).sort()).toEqual(['at', 'callerNodeId', 'ref', 'scope']);
  });

  it('SC-011: callerNodeId is preserved verbatim (null when omitted)', () => {
    vault.store('home-hub', 'fal-key', 'sk_value_xxxxxxxxxxxxxxxx_long');
    vault.resolve('home-hub', 'fal-key'); // no callerNodeId arg
    vault.resolve('home-hub', 'fal-key', null); // explicit null
    vault.resolve('home-hub', 'fal-key', 'node-X');
    const tail = vault.audit().slice(-3);
    expect(tail.map((e) => e.callerNodeId)).toEqual([null, null, 'node-X']);
  });

  it('integration: stored secret value is never echoed into the audit log', () => {
    // INV-19 bridges into SC-011 here: the audit log is read by tooling that
    // may be less privileged than the vault itself, so the raw value must
    // not leak through entries. Use a known sentinel value to scan against.
    const sentinel = 'sk_sentinel_DO_NOT_LEAK_xxxxxxx';
    vault.store('home-hub', 'fal-key', sentinel);
    vault.resolve('home-hub', 'fal-key', 'node-1');
    vault.resolve('home-hub', 'fal-key', 'node-2');
    const log = vault.audit();
    for (const entry of log) {
      // No field on an audit entry should ever contain the raw secret.
      expect(JSON.stringify(entry).includes(sentinel)).toBe(false);
    }
  });
});

describe('EB-02-07 — FP-06 spot-check against the vault source itself', () => {
  it('src/server/secrets/vault.ts contains no FP-06 raw-secret literal', () => {
    const src = readFileSync(
      join(repoRoot, 'src', 'server', 'secrets', 'vault.ts'),
      'utf8',
    );
    expect(src).not.toMatch(FP06);
  });
});

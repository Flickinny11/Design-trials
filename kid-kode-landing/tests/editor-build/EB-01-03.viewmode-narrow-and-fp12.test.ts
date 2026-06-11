// EB-01-03 — remove legacy viewMode literals; arm FP-12.
//
// Spec refs (as amended): the archived PRISM-EDITOR-BUILD-SPEC's §1 SC-002 /
// SC-003 / FP-12 / INV-20, superseded for the mode set by Round 2 RA-06b /
// INV-24 and by the canonical PRISM-RUNTIME-SPEC §1.3/§6 + FP-R8: the
// canonical view modes are EXACTLY `galaxy | canvas | preview-app`.
// 'hub-world' and 'preview-hub' (the Round-1 5-mode set) are superseded and
// FP-14 forbids those literals anywhere under src/.
//
// What this file pins now:
//
//   1. The store's state field and setter signature are narrowed to
//      `ViewMode` so off-canon strings can no longer flow into the toggle
//      via setViewMode (INV-20 type-level enforcement).
//   2. The FP-12 regex is armed in .claude/hooks/anti-drift-check.sh against
//      the FULL legacy set (Round-0 `preview|editor|split` AND Round-1
//      `hub-world|preview-hub`), and FP-14 blocks the superseded literals
//      outright.
//   3. Zero legacy-literal value sites remain in the store / page / Inspector.
//   4. page.tsx renders ONE unified GraphScene for all three modes — there is
//      no separate PrismHost compiled mount and no preview-hub gate
//      (RT-SC-03 / INV-R3 / FP-R5; supersedes the old SC-003 assertion that
//      PrismHost stayed mounted behind preview-hub).
//
// Source-shape assertions read the files directly. The two-runtime snapshot
// captured the rendered baseline at notes/ralph-snapshots/EB-01-03/.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const storePath = join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts');
const pagePath = join(repoRoot, 'src', 'app', 'page.tsx');
const inspectorPath = join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx');
const hookPath = join(repoRoot, '.claude', 'hooks', 'anti-drift-check.sh');

// Round-0 legacy (preview|editor|split) AND Round-1 superseded
// (hub-world|preview-hub) — none may appear at a viewMode value site.
const LEGACY_VALUE_RE =
  /viewMode[\t ]*[:=][\t ]*['"](preview|editor|split|hub-world|preview-hub)['"]/g;

describe('EB-01-03 — narrow ViewMode, arm FP-12, preserve preview-hub mount', () => {
  it('store state field viewMode is typed `ViewMode` (not `AnyViewMode`)', () => {
    const src = readFileSync(storePath, 'utf8');
    // GraphEditorState interface body: the canonical state field declaration
    // must be `viewMode: ViewMode;` so the toggle's type-system rejects any
    // off-canon literal.
    expect(src).toMatch(/^\s*viewMode:\s*ViewMode;\s*$/m);
    // The widened transient type must be gone from the state-field site.
    expect(src).not.toMatch(/^\s*viewMode:\s*AnyViewMode;\s*$/m);
  });

  it('setViewMode action signature is `(m: ViewMode) => void`', () => {
    const src = readFileSync(storePath, 'utf8');
    expect(src).toMatch(/setViewMode:\s*\(m:\s*ViewMode\)\s*=>\s*void/);
    expect(src).not.toMatch(/setViewMode:\s*\(m:\s*AnyViewMode\)\s*=>\s*void/);
  });

  it('store source contains zero legacy `viewMode:` / `viewMode=` value sites', () => {
    const src = readFileSync(storePath, 'utf8');
    const hits = Array.from(src.matchAll(LEGACY_VALUE_RE));
    expect(hits).toHaveLength(0);
  });

  it('page.tsx and Inspector.tsx contain zero legacy viewMode value-site literals', () => {
    for (const p of [pagePath, inspectorPath]) {
      const src = readFileSync(p, 'utf8');
      const hits = Array.from(src.matchAll(LEGACY_VALUE_RE));
      expect(hits).toHaveLength(0);
    }
  });

  it('anti-drift hook arms FP-12 (v1.1) against the FULL legacy literal set and FP-14 against superseded modes (RA-06b / INV-24)', () => {
    const src = readFileSync(hookPath, 'utf8');
    // FP-12 v1.1 — the hook greps viewMode value sites for BOTH the Round-0
    // legacy (preview|editor|split) AND the Round-1 superseded modes
    // (hub-world|preview-hub). A regression back to the Round-1 regex (which
    // accepted hub-world/preview-hub as canonical) fails here.
    expect(src).toContain('viewMode[[:space:]]*[:=][[:space:]]*');
    expect(src).toContain('(preview|editor|split|hub-world|preview-hub)');
    expect(src).toMatch(/FP-12: legacy viewMode literal/);
    // FP-14 — superseded-mode literals are blocked ANYWHERE under src/, not
    // just at viewMode value sites.
    expect(src).toContain('(hub-world|preview-hub)');
    expect(src).toMatch(/FP-14/);
  });

  it('page.tsx renders ONE unified GraphScene — no PrismHost mount, no preview-hub gate (RT-SC-03 / INV-R3 / FP-R5; supersedes SC-003)', () => {
    const src = readFileSync(pagePath, 'utf8');
    // RA-06b folded preview-hub into preview-app, and the canonical runtime
    // spec made preview-app a STATE of the same GraphScene (not a separate
    // compiled PrismHost mount — FP-R5). Either superseded shape returning —
    // a preview-hub gate or a <PrismHost> mount in page.tsx — fails here.
    expect(src).not.toMatch(/viewMode\s*===\s*['"]preview-hub['"]/);
    expect(src).not.toMatch(/<PrismHost\b/);
    expect(src).toMatch(/<GraphScene\s*\/>/);
  });

  it('EB-01-03 snapshot directory contains outer.png + inner.png + state.json', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-01-03');
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});

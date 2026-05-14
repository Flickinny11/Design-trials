// EB-01-03 — remove legacy viewMode literals; arm FP-12; baseline preview-hub.
//
// Spec refs: §1 SC-002, §1 SC-003, §1 FP-12, §1 INV-20 of
// PRISM-EDITOR-BUILD-SPEC.md.
//
// EB-01-01 widened the store's setter to AnyViewMode and shipped the
// legacy→canonical mapping table. EB-01-02 migrated the page.tsx / Inspector
// call sites to canonical literals. EB-01-03 closes the loop:
//
//   1. The store's state field and setter signature are narrowed back to
//      `ViewMode` so off-canon strings can no longer flow into the toggle
//      via setViewMode (INV-20 type-level enforcement).
//   2. The FP-12 regex is armed in .claude/hooks/anti-drift-check.sh so any
//      future Write/Edit attempting to commit a legacy literal at a value
//      site is blocked.
//   3. Zero matches for `viewMode: 'preview'|'editor'|'split'` (and `=`
//      assignment form) remain under kid-kode-landing/src/.
//   4. The PrismHost preview path is still mounted behind preview-hub /
//      preview-app — SC-003: Codex's preview logic is preserved, not
//      deleted.
//
// Source-shape assertions read the files directly. The two-runtime snapshot
// captures the rendered baseline at notes/ralph-snapshots/EB-01-03/.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const storePath = join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts');
const pagePath = join(repoRoot, 'src', 'app', 'page.tsx');
const inspectorPath = join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx');
const hookPath = join(repoRoot, '.claude', 'hooks', 'anti-drift-check.sh');

const LEGACY_VALUE_RE =
  /viewMode[\t ]*[:=][\t ]*['"](preview|editor|split)['"]/g;

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

  it('anti-drift hook arms FP-12 against legacy viewMode literals (RA-06)', () => {
    const src = readFileSync(hookPath, 'utf8');
    // The hook must run a grep against the legacy viewMode literal pattern
    // AND push an FP-12 violation message.
    expect(src).toContain('viewMode[[:space:]]*[:=][[:space:]]*');
    expect(src).toContain('(preview|editor|split)');
    expect(src).toMatch(/FP-12: legacy viewMode literal/);
  });

  it('page.tsx still mounts PrismHost behind preview-hub / preview-app (SC-003)', () => {
    const src = readFileSync(pagePath, 'utf8');
    // The preview pane must be gated by a derived predicate that includes the
    // canonical preview-hub mode and must render a <PrismHost ... />.
    expect(src).toMatch(/viewMode\s*===\s*['"]preview-hub['"]/);
    expect(src).toMatch(/<PrismHost\b/);
  });

  it('EB-01-03 snapshot directory contains outer.png + inner.png + state.json', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-01-03');
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});

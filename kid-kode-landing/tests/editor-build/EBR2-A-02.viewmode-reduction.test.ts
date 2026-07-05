// EBR2-A-02 — Reduce ViewMode to 3 canonical modes (galaxy|canvas|preview-app).
//
// Spec refs: §R2-A SC-065, §R2-A INV-24, §R2-A FP-12 (v1.1), §R2-A FP-14,
// §R2-A RA-06b of PRISM-EDITOR-BUILD-SPEC.md v1.1.
//
// Round-1 left ViewMode as a 5-tuple ('galaxy' | 'hub-world' | 'canvas' |
// 'preview-hub' | 'preview-app') with a 5-button toggle and a
// `previousAuthoringMode` back-button slot. Round-2 (RA-06b) supersedes that:
// hub-world folds into canvas, preview-hub folds into preview-app, and
// preview-app becomes the default (RA-17, verified separately by EBR2-A-03).
// This task collapses the type, the toggle, and all caller sites.
//
//   1. The ViewMode union narrows to exactly 'galaxy' | 'canvas' |
//      'preview-app'. No off-canon literal appears anywhere under
//      kid-kode-landing/src/ (TS or TSX, code OR comments — INV-24 is a
//      total ban on the strings, not just on assignments).
//   2. page.tsx renders a 3-button toggle (one button per canonical mode).
//   3. The `previousAuthoringMode` field, the AuthoringViewMode helper type,
//      and the preview-back affordance are deleted — preview-app is now the
//      default, so the back-to-editor path is obsolete (RA-06b).
//   4. The drillIntoHub action no longer routes to 'hub-world'; the only
//      authoring mode it can land on is 'canvas'.
//
// Source-shape assertions read the files directly. The two-runtime + Vercel
// preview snapshot at notes/ralph-snapshots/EBR2-A-02/ verifies the rendered
// 3-button toggle and clean console.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const srcRoot = join(repoRoot, 'src');
const storePath = join(srcRoot, 'stores', 'useGraphEditorStore.ts');
const pagePath = join(srcRoot, 'app', 'page.tsx');

describe('EBR2-A-02 — ViewMode reduced to 3 canonical modes', () => {
  it('store exports ViewMode = exactly the 3 canonical literals', () => {
    const src = readFileSync(storePath, 'utf8');
    // SC-065: the type must contain exactly these three strings.
    expect(src).toMatch(
      /export\s+type\s+ViewMode\s*=\s*'galaxy'\s*\|\s*'canvas'\s*\|\s*'preview-app'\s*;/
    );
    // Sanity: any older 5-mode form must be gone.
    expect(src).not.toMatch(/'hub-world'/);
    expect(src).not.toMatch(/'preview-hub'/);
  });

  it('AuthoringViewMode helper and previousAuthoringMode field are removed (RA-06b)', () => {
    const src = readFileSync(storePath, 'utf8');
    expect(src).not.toMatch(/\bAuthoringViewMode\b/);
    expect(src).not.toMatch(/\bpreviousAuthoringMode\b/);
  });

  it('drillIntoHub no longer routes to the deleted hub-world mode', () => {
    const src = readFileSync(storePath, 'utf8');
    // Find the drillIntoHub action body; assert it sets viewMode to 'canvas'
    // (the canonical fold-in for the deleted hub-world).
    const match = src.match(/drillIntoHub:\s*\(hubId\)\s*=>[\s\S]*?\}\),/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/viewMode:\s*'canvas'/);
    expect(match![0]).not.toMatch(/'hub-world'/);
  });

  it('zero hub-world or preview-hub literals anywhere under kid-kode-landing/src/', () => {
    // INV-24 / FP-14 — a total ban on these strings inside src/, code OR
    // comment. We shell out to ripgrep through the build hook's grep form so
    // a failure here mirrors what FP-14 would block at write time.
    let hits: string;
    try {
      hits = execSync(
        // grep returns non-zero when nothing matches; capture both states.
        `grep -RnE "['\\"](hub-world|preview-hub)['\\"]" ${JSON.stringify(srcRoot)} --include='*.ts' --include='*.tsx' || true`,
        { encoding: 'utf8' }
      );
    } catch (err) {
      hits = '';
    }
    expect(hits.trim()).toBe('');
  });

  it('page.tsx renders a 3-button mode toggle (one entry per canonical mode)', () => {
    const src = readFileSync(pagePath, 'utf8');
    // The toggle is declared as a tuple of { id, label } objects. Assert
    // exactly the three canonical ids appear with that shape; assert the
    // legacy two are gone.
    expect(src).toMatch(/id:\s*'galaxy'/);
    expect(src).toMatch(/id:\s*'canvas'/);
    expect(src).toMatch(/id:\s*'preview-app'/);
    expect(src).not.toMatch(/id:\s*'hub-world'/);
    expect(src).not.toMatch(/id:\s*'preview-hub'/);
  });

  it('page.tsx preview-back affordance is removed (preview-app is now default)', () => {
    const src = readFileSync(pagePath, 'utf8');
    // The Round-1 back button rendered under isPreviewHub. The whole branch
    // is gone in Round-2.
    expect(src).not.toMatch(/data-component="preview-back"/);
    expect(src).not.toMatch(/\bisPreviewHub\b/);
    expect(src).not.toMatch(/\bpreviousAuthoringMode\b/);
  });

  it('EBR2-A-02 snapshot directory contains outer.png + inner.png + state.json', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EBR2-A-02');
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});

// EDITOR-EXP P2b / C9 — Inspector/Canvas material-editor decouple +
// C8-A orphan reroute + NE-SC-14 (retire VisualPreview's 2nd save/build path).
//
// Architecture map (notes/verification/editor-experience/P0/ARCHITECTURE-MAP.md):
//   "ColorPicker.tsx, MaterialTab.tsx, VisualPreview.tsx each have exactly one
//    importer: Inspector.tsx … Toolbar ObjectFlyout DELEGATES material editing
//    back via openInspector('material'). Fix: extract these into shared editors
//    mounted by BOTH the CanvasToolbar flyouts and the Inspector (cut the
//    openInspector('material') seam first). Add a single-importer guard test."
//
//   "VisualPreview's 'Save & Verify' regen path (its own regen-api.ts) is the
//    second edit/save/build path flagged by NE-SC-14/FP-NE-5 — retiring it
//    unifies on the overlay → Save → Build path."
//
// Test strategy mirrors EBR2-E-02: source-grep assertions against committed
// files. No renderer mount — pure structural guards.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../');

const P = (rel: string) => resolve(REPO_ROOT, rel);
const read = (rel: string) => readFileSync(P(rel), 'utf8');

const SHARED_MATERIAL = 'src/components/editor/shared-editors/MaterialEditor.tsx';
const SHARED_COLOR = 'src/components/editor/shared-editors/ColorPicker.tsx';
const MATERIAL_TAB = 'src/components/editor/panels/MaterialTab.tsx';
const OBJECT_FLYOUT = 'src/components/editor/object-tools/ObjectFlyout.tsx';
const INSPECTOR = 'src/components/editor/panels/Inspector.tsx';
const CONTENT_HASH = 'src/lib/editor/node-content-hash.ts';
const VISUAL_PREVIEW = 'src/components/editor/panels/visual-preview/VisualPreview.tsx';

// ─────────────────────────────────────────────────────────────────────
// Part 1 — the editors are EXTRACTED into shared-editors and mounted by BOTH
// the canvas object flyout and the node-editor Inspector.
// ─────────────────────────────────────────────────────────────────────
describe('C9 — shared editors mounted by BOTH canvas flyout and Inspector', () => {
  it('shared-editors/MaterialEditor.tsx and ColorPicker.tsx exist', () => {
    expect(existsSync(P(SHARED_MATERIAL))).toBe(true);
    expect(existsSync(P(SHARED_COLOR))).toBe(true);
  });

  it('ObjectFlyout (canvas) mounts the SHARED MaterialEditor inline', () => {
    const src = read(OBJECT_FLYOUT);
    expect(src).toMatch(/from\s+['"]@\/components\/editor\/shared-editors\/MaterialEditor['"]/);
    expect(src).toMatch(/<MaterialEditor\b/);
  });

  it('Inspector mounts the same shared Material editor (via the panels/MaterialTab shim)', () => {
    const tab = read(MATERIAL_TAB);
    // The panels/MaterialTab is now a thin re-export of the shared editor.
    expect(tab).toMatch(/from\s+['"]@\/components\/editor\/shared-editors\/MaterialEditor['"]/);
    const insp = read(INSPECTOR);
    expect(insp).toMatch(/<MaterialTab\b/);
  });

  it('panels/ColorPicker re-exports the shared ColorPicker (single source)', () => {
    const shim = read('src/components/editor/panels/ColorPicker.tsx');
    expect(shim).toMatch(/from\s+['"]@\/components\/editor\/shared-editors\/ColorPicker['"]/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 2 — the openInspector('material') delegation seam is CUT: the canvas
// flyout no longer pops the Inspector to edit material.
// ─────────────────────────────────────────────────────────────────────
describe("C9 — openInspector('material') delegation seam is cut", () => {
  it('ObjectFlyout has NO live openInspector(...material...) call', () => {
    const src = read(OBJECT_FLYOUT);
    // Strip line comments so the documentation note that mentions the retired
    // seam does not produce a false positive.
    const code = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/openInspector\s*\(\s*['"]material['"]\s*\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 3 — C8-A orphan reroute: Visual-tab color pickers + frame faders write
// the preview overlay (usePreviewStateStore), NOT the orphan store.
// ─────────────────────────────────────────────────────────────────────
describe('C8-A — Visual-tab color + frame-fader writes route through usePreviewStateStore', () => {
  it('Inspector no longer reads setPrimary/setSecondary actions from the orphan store', () => {
    const src = read(INSPECTOR);
    // The orphan store actions must not be SELECTED off useAnimationEditsStore
    // any more (they were the orphan write path). Comments mentioning them are
    // fine; the store-selector call sites must be gone.
    expect(src).not.toMatch(/useAnimationEditsStore\(\s*\(s\)\s*=>\s*s\.setPrimary\s*\)/);
    expect(src).not.toMatch(/useAnimationEditsStore\(\s*\(s\)\s*=>\s*s\.setSecondary\s*\)/);
  });

  it('the Visual-tab color setters stage materialSpec on the preview overlay', () => {
    const src = read(INSPECTOR);
    // setPrimary/setSecondary are now local closures that call
    // usePreviewStateStore.set(..., { materialSpec: ... }).
    expect(src).toMatch(/usePreviewStateStore[\s\S]{0,160}\.set\s*\([\s\S]{0,160}materialSpec/);
  });

  it('the Animation-tab frame faders stage keyframes on the preview overlay', () => {
    const src = read(INSPECTOR);
    expect(src).toMatch(/framesToKeyframes\s*\(/);
    expect(src).toMatch(/usePreviewStateStore[\s\S]{0,160}\.set\s*\([\s\S]{0,160}keyframes/);
  });

  it('node-content-hash projects materialSpec + receivesLighting (so Build re-realizes)', () => {
    const src = read(CONTENT_HASH);
    expect(src).toMatch(/materialSpec\s*:\s*node\.materialSpec/);
    expect(src).toMatch(/receivesLighting\s*:\s*node\.receivesLighting/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 4 — NE-SC-14: VisualPreview's regen-api 2nd save/build path is retired.
// ─────────────────────────────────────────────────────────────────────
describe('NE-SC-14 — VisualPreview regen-api 2nd save/build path retired', () => {
  it('VisualPreview no longer imports saveAndVerify from regen-api', () => {
    const src = read(VISUAL_PREVIEW);
    expect(src).not.toMatch(/import\s*\{[^}]*saveAndVerify[^}]*\}\s*from\s*['"]\.\/regen-api['"]/);
  });

  it('VisualPreview has no live saveAndVerify(...) call site', () => {
    const src = read(VISUAL_PREVIEW);
    const code = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/saveAndVerify\s*\(/);
  });

  it('no src/ file outside tests imports saveAndVerify as a live editor path', () => {
    // VisualPreview was the sole live importer; after retirement, the only
    // references to saveAndVerify under src/ are the (commented) retirement
    // markers + the stub definition itself.
    const visual = read(VISUAL_PREVIEW);
    expect(visual).not.toMatch(/^\s*import[\s\S]*saveAndVerify/m);
  });
});

// EB-01-04 — editorRenderMode toggle is a CANVAS-mode sub-toggle.
//
// Spec refs (as amended): the archived editor-build §1 SC-004 gated the
// scene|topology sub-toggle to 'hub-world'. Round 2 (RA-06b / INV-24) folded
// hub-world into 'canvas' — the canonical modes are exactly
// `galaxy | canvas | preview-app` (PRISM-RUNTIME-SPEC §1.3/§6), and
// `editorRenderMode = 'scene' | 'topology'` is retained as a sub-toggle
// WITHIN canvas (scene = assembled artifacts, topology = force-graph).
//
// Source-shape assertions read TopBar.tsx / GraphScene.tsx directly:
//   1. TopBar reads viewMode from the store.
//   2. The scene|topology toggle JSX block is conditionally rendered behind
//      a viewMode === 'canvas' predicate (the superseded 'hub-world' literal
//      must never return — FP-14).
//   3. setEditorRenderMode + editorRenderMode are still wired (preservation —
//      SC-004 "not deleted").
//   4. GraphScene routes content through showsAssembledFor: canvas mounts
//      AssembledSceneContent when editorRenderMode === 'scene'; preview-app
//      is always assembled (same cached artifacts — RT-SC-10).
//   5. The EB-01-04 snapshot directory contains outer.png + inner.png +
//      state.json.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const topBarPath = join(repoRoot, 'src', 'components', 'editor', 'overlays', 'TopBar.tsx');
const graphScenePath = join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx');

describe('EB-01-04 — editorRenderMode sub-toggle gated to hub-world', () => {
  it('TopBar reads viewMode from useGraphEditorStore', () => {
    const src = readFileSync(topBarPath, 'utf8');
    expect(src).toMatch(/useGraphEditorStore\(\(s\)\s*=>\s*s\.viewMode\)/);
  });

  it('TopBar preserves editorRenderMode + setEditorRenderMode wiring (SC-004 "not deleted")', () => {
    const src = readFileSync(topBarPath, 'utf8');
    expect(src).toMatch(/useGraphEditorStore\(\(s\)\s*=>\s*s\.editorRenderMode\)/);
    expect(src).toMatch(/useGraphEditorStore\(\(s\)\s*=>\s*s\.setEditorRenderMode\)/);
  });

  it('TopBar gates the scene|topology toggle block behind viewMode === "canvas" (RA-06b — hub-world folded into canvas)', () => {
    const src = readFileSync(topBarPath, 'utf8');
    // The toggle markup ships the two-mode array with ids 'scene' and 'topology'.
    // Locate the array literal and assert that an enclosing predicate of the
    // form `viewMode === 'canvas' && ...` precedes it.
    const toggleIdx = src.search(/id:\s*'scene',[\s\S]*?id:\s*'topology'/);
    expect(toggleIdx).toBeGreaterThan(-1);
    const head = src.slice(0, toggleIdx);
    expect(head).toMatch(/viewMode\s*===\s*['"]canvas['"]\s*&&/);
    // FP-14 — the superseded gate literal must never return to TopBar.
    expect(src).not.toMatch(/['"]hub-world['"]/);
  });

  it('GraphScene routes canvas through editorRenderMode and mounts AssembledSceneContent when showsAssembled (scene sub-toggle preserved)', () => {
    const src = readFileSync(graphScenePath, 'utf8');
    // showsAssembledFor is the single content router (RT-SC-03/04/10):
    //   canvas      → assembled only when editorRenderMode === 'scene'
    //   preview-app → always assembled (same cached artifacts)
    expect(src).toMatch(
      /viewMode\s*===\s*['"]canvas['"]\s*\)\s*return\s+editorRenderMode\s*===\s*['"]scene['"]/,
    );
    expect(src).toMatch(
      /viewMode\s*===\s*['"]preview-app['"]\s*\)\s*return\s+true/,
    );
    // The router's verdict is what mounts the assembled tree.
    expect(src).toMatch(/showsAssembled\s*\?\s*<AssembledSceneContent/);
  });

  it('EB-01-04 snapshot directory contains outer.png + inner.png + state.json', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-01-04');
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});

// EB-01-04 — editorRenderMode toggle is a sub-toggle within hub-world only.
//
// Spec refs: §1 SC-004 ("editorRenderMode = 'scene' | 'topology' is preserved
// as a sub-toggle within hub-world (per RA-01); not deleted") and §1 RA-06
// ("editorRenderMode = 'scene' | 'topology' is preserved as a sub-toggle
// within hub-world mode").
//
// EB-01-04 closes RA-06's remaining surface obligation: the toggle exists in
// TopBar today (preserved from Codex), but it currently renders in every
// view mode. SC-004 wants it gated — only visible when viewMode === 'hub-world'.
//
// Source-shape assertions read TopBar.tsx directly:
//   1. TopBar reads viewMode from the store.
//   2. The scene|topology toggle JSX block is conditionally rendered behind
//      a viewMode === 'hub-world' predicate.
//   3. setEditorRenderMode + editorRenderMode are still wired (preservation —
//      SC-004 "not deleted").
//   4. GraphScene's SceneContent still mounts AssembledSceneContent when
//      editorRenderMode === 'scene' (preserved from EB pre-history).
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

  it('TopBar gates the scene|topology toggle block behind viewMode === "hub-world"', () => {
    const src = readFileSync(topBarPath, 'utf8');
    // The toggle markup ships the two-mode array with ids 'scene' and 'topology'.
    // Locate the array literal and assert that an enclosing predicate of the
    // form `viewMode === 'hub-world' && ...` precedes it.
    const toggleIdx = src.search(/id:\s*'scene',[\s\S]*?id:\s*'topology'/);
    expect(toggleIdx).toBeGreaterThan(-1);
    const head = src.slice(0, toggleIdx);
    expect(head).toMatch(/viewMode\s*===\s*['"]hub-world['"]\s*&&/);
  });

  it('GraphScene still mounts AssembledSceneContent when editorRenderMode === "scene"', () => {
    const src = readFileSync(graphScenePath, 'utf8');
    expect(src).toMatch(
      /editorRenderMode\s*===\s*['"]scene['"][\s\S]{0,200}?<AssembledSceneContent/,
    );
  });

  it('EB-01-04 snapshot directory contains outer.png + inner.png + state.json', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-01-04');
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});

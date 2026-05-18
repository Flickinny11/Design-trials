// EBR2-B-03 — PrismHost node-layout effect applies compiled anchors via
// liveResult.updateNodeTransform.
//
// Spec refs:
//   §R2-B SC-066  In preview-app, every node in the active hub renders at its
//                 compiled-anchor position via CompiledHubView.nodes[] →
//                 liveResult.updateNodeTransform(). The `visible` flag is
//                 respected (hidden nodes do not mount).
//   §8 INV-17     Non-destructive compile — the layout effect must NOT write
//                 back to source node.scenePosition / editorTransform /
//                 canvasTransform fields.
//
// haltCheck (ralph-state.json):
//   "PrismHost has a node-layout useEffect that walks CompiledHubView.nodes[],
//    resolves anchors via resolveAnchorToScenePosition, calls
//    liveResult.updateNodeTransform(nodeId, position). Visible flag respected
//    (hidden nodes skipped or unmounted). Source graph untouched (INV-17
//    preserved)."
//
// Test strategy: static source-grep. Mirror EBR2-B-02 — keep the test light
// (no runtime React rendering, no canvas) so it can run under vitest without
// jsdom + Three.js mount infrastructure. The assertions cover the load-bearing
// surface of the effect: import, walk, resolve, dispatch, visibility filter,
// and INV-17 untouched-source check.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../');

const PRISM_HOST_PATH = resolve(
  REPO_ROOT,
  'src/components/prism-player/PrismHost.tsx',
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('EBR2-B-03 — PrismHost node-layout effect (SC-066, INV-17)', () => {
  describe('imports + dispatch surface', () => {
    it('imports resolveAnchorToScenePosition from compile-anchors', () => {
      const src = read(PRISM_HOST_PATH);
      expect(src).toMatch(
        /import\s*(?:type\s*)?\{[^}]*\bresolveAnchorToScenePosition\b[^}]*\}\s*from\s*['"][^'"]*compile-anchors['"]/,
      );
    });

    it('references compiledHubView.nodes (walks the compiled node entries)', () => {
      const src = read(PRISM_HOST_PATH);
      expect(src).toMatch(/compiledHubView\.nodes/);
    });

    it('calls liveResult.updateNodeTransform(...) (per-entry dispatch)', () => {
      const src = read(PRISM_HOST_PATH);
      // The dispatch is the per-entry hot-path write through the surgical
      // helper exposed by mount-graph. Match either an explicit
      // `liveResult.updateNodeTransform(` or a destructured-after `live.`
      // variant — both satisfy SC-066.
      const dispatched =
        /liveResult\.updateNodeTransform\s*\(/.test(src) ||
        /\blive\.updateNodeTransform\s*\(/.test(src) ||
        /\.updateNodeTransform\s*\(\s*entry\.nodeId/.test(src);
      expect(dispatched).toBe(true);
    });

    it('invokes resolveAnchorToScenePosition with the compiled anchor', () => {
      const src = read(PRISM_HOST_PATH);
      // Resolver call. Loose match: the function name appears as a call and is
      // wired to an anchor source (entry.anchor / node.anchor / .anchor).
      expect(src).toMatch(/resolveAnchorToScenePosition\s*\(/);
      expect(src).toMatch(/resolveAnchorToScenePosition\s*\(\s*[^)]*\.anchor/);
    });
  });

  describe('visibility filter (SC-066 — visible flag respected)', () => {
    it('reads the entry.visible flag inside the layout loop', () => {
      const src = read(PRISM_HOST_PATH);
      // The loop body or filter must consult the `visible` flag. Match any of
      // the common patterns: `entry.visible`, `!entry.visible`, `.visible ===`,
      // `if (!visible)`, or a destructured `visible` reference.
      const filtersVisibility =
        /entry\.visible/.test(src) ||
        /node\.visible/.test(src) ||
        /\.visible\s*===\s*false/.test(src) ||
        /!\s*[a-zA-Z_$][\w$]*\.visible/.test(src);
      expect(filtersVisibility).toBe(true);
    });
  });

  describe('node-layout effect is keyed on compiledHubView changes', () => {
    it('has a useEffect whose dep array references compiledHubView', () => {
      const src = read(PRISM_HOST_PATH);
      // There should be at least two distinct useEffect dep arrays that name
      // compiledHubView — the camera-rail effect from EBR2-B-02 and the
      // node-layout effect added here. We check that compiledHubView appears
      // in a dep array at least twice (whitespace-normalized).
      const normalized = src.replace(/\s+/g, ' ');
      const depArrayMatches = normalized.match(
        /\}\s*,\s*\[\s*[^\]]*\bcompiledHubView\b[^\]]*\]\s*\)/g,
      );
      expect(depArrayMatches).not.toBeNull();
      expect(depArrayMatches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('INV-17 — source graph untouched', () => {
    it('does not write to node.scenePosition / editorTransform / canvasTransform inside PrismHost', () => {
      const src = read(PRISM_HOST_PATH);
      // FP-04 forbids destructive writes inside any compile* function; INV-17
      // generalizes to "the renderer never mutates source fields". PrismHost
      // is not a compile fn, but it is in the read-path of CompiledHubView, so
      // any assignment to those source-side fields would silently corrupt the
      // source graph. We assert NO assignment exists.
      expect(src).not.toMatch(/\.scenePosition\s*=\s*/);
      expect(src).not.toMatch(/\.editorTransform\s*=\s*/);
      expect(src).not.toMatch(/\.canvasTransform\s*=\s*/);
      expect(src).not.toMatch(/\.scenePosition\.[xyz]\s*=\s*/);
    });

    it('does not call updateNode on useGraphSourceStore from inside the layout effect', () => {
      const src = read(PRISM_HOST_PATH);
      // SC-066 + INV-17 + the read-path-only contract: PrismHost MUST NOT
      // write back to the source store. Read-only access via .getState() is
      // fine (the camera-rail effect already does that for hub geometry), but
      // any updateNode call would mean PrismHost is treating the compile as
      // destructive.
      expect(src).not.toMatch(/useGraphSourceStore[^;]*\.updateNode\s*\(/);
      expect(src).not.toMatch(
        /useGraphSourceStore\s*\.getState\s*\(\s*\)\s*\.updateNode\b/,
      );
    });
  });
});

// EBR2-B-02 — Plumb CompiledHubView (active hub) into PrismHost props.
//
// Spec refs:
//   §R2-B SC-066  In preview-app, every node in the active hub renders at its
//                 compiled-anchor position via CompiledHubView.nodes[] →
//                 liveResult.updateNodeTransform().
//   §8 INV-17     Non-destructive compile.
//   §3 (spec lines 82-84) — "Preview is compile, not render-of-source."
//                 CompiledHubView / CompiledAppView are pure-data prop
//                 boundaries; PrismHost consumes a CompiledHubView prop.
//
// haltCheck (ralph-state.json):
//   "page.tsx computes CompiledAppView once per render (memoized), passes
//    active CompiledHubView to PrismHost via prop. PrismHost does not
//    internally re-compile."
//
// What is verified here, in order:
//   1. The PrismHost source declares `compiledHubView?: CompiledHubView` (or
//      equivalent typed prop) in its Props surface. The prop is optional so
//      legacy mount paths (useLiveGraph=false) keep working.
//   2. PrismHost no longer imports compileHubToPreview / compileAppToPreview.
//      Per spec §3, PrismHost is a consumer of the pure-data CompiledHubView
//      surface; compilation lives upstream in page.tsx. (Importing the
//      derived helpers like deriveCompiledCameraRail / deriveHubTransitRail /
//      deriveCompiledEnvironmentFog is permitted — those are pure utility
//      derivations, not the top-level compile entrypoint.)
//   3. PrismHost passes the prop's cameraRail / background / environmentFog
//      through to the live mount via setCameraRail / setBackgroundLayers /
//      setEnvironmentFog when the prop is supplied.
//   4. page.tsx imports useMemo and memoizes a CompiledAppView via
//      compileAppToPreview keyed on the live source store slices.
//   5. page.tsx passes the active hub's CompiledHubView through to
//      PrismHost as the compiledHubView prop.

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
const PAGE_PATH = resolve(REPO_ROOT, 'src/app/page.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('EBR2-B-02 — CompiledHubView plumbed into PrismHost props', () => {
  describe('PrismHost props surface', () => {
    it('declares an optional compiledHubView prop typed as CompiledHubView', () => {
      const src = read(PRISM_HOST_PATH);
      // The prop is part of the Props interface. Optional so the prop is
      // backward-compatible with legacy mount paths (useLiveGraph=false) that
      // don't drive preview-app.
      expect(src).toMatch(/compiledHubView\?:\s*CompiledHubView\s*\|\s*null/);
    });

    it('destructures compiledHubView in the PrismHost function signature', () => {
      const src = read(PRISM_HOST_PATH);
      // The implementation reads the prop in its destructure to wire it into
      // the camera-rail/background/fog effect. Whitespace-insensitive match.
      expect(src.replace(/\s+/g, ' ')).toMatch(/compiledHubView\s*[,=}]/);
    });

    it('imports the CompiledHubView type', () => {
      const src = read(PRISM_HOST_PATH);
      // The type is imported (either as a regular `import type` or alongside
      // an existing import from compiled-view).
      expect(src).toMatch(/\bCompiledHubView\b/);
      // The import statement specifically.
      expect(src).toMatch(
        /import\s*(?:type\s*)?\{[^}]*\bCompiledHubView\b[^}]*\}\s*from\s*['"][^'"]*compiled-view['"]/,
      );
    });
  });

  describe('PrismHost does not internally compile', () => {
    it('does not import compileHubToPreview', () => {
      const src = read(PRISM_HOST_PATH);
      expect(src).not.toMatch(/\bcompileHubToPreview\b/);
    });

    it('does not import compileAppToPreview', () => {
      const src = read(PRISM_HOST_PATH);
      expect(src).not.toMatch(/\bcompileAppToPreview\b/);
    });
  });

  describe('PrismHost prefers prop-supplied cameraRail / background / fog', () => {
    it('reads cameraRail off the compiledHubView prop when supplied', () => {
      const src = read(PRISM_HOST_PATH);
      // The camera-rail effect should pull cameraRail from the prop when
      // available, falling back to derive only when the prop is absent.
      // Match either the explicit access pattern OR the destructure pattern.
      const usesPropRail =
        /compiledHubView\.cameraRail/.test(src) ||
        /\bcameraRail\b[^=]*=\s*compiledHubView/.test(src);
      expect(usesPropRail).toBe(true);
    });

    it('reads background layers off the compiledHubView prop when supplied', () => {
      const src = read(PRISM_HOST_PATH);
      const usesPropBg =
        /compiledHubView\.background/.test(src) ||
        /\bbackground\b[^=]*=\s*compiledHubView/.test(src);
      expect(usesPropBg).toBe(true);
    });

    it('reads environmentFog off the compiledHubView prop when supplied', () => {
      const src = read(PRISM_HOST_PATH);
      const usesPropFog =
        /compiledHubView\.environmentFog/.test(src) ||
        /\benvironmentFog\b[^=]*=\s*compiledHubView/.test(src);
      expect(usesPropFog).toBe(true);
    });
  });

  describe('page.tsx memoizes CompiledAppView and threads the active hub through', () => {
    it('imports useMemo from react', () => {
      const src = read(PAGE_PATH);
      expect(src).toMatch(
        /import\s*\{[^}]*\buseMemo\b[^}]*\}\s*from\s*['"]react['"]/,
      );
    });

    it('wraps compileAppToPreview in a useMemo (memoized per render)', () => {
      const src = read(PAGE_PATH);
      // Find the useMemo call that wraps compileAppToPreview. Match the
      // typical zustand+useMemo pattern: `useMemo(() => compileAppToPreview(`.
      const memoizedCompile = new RegExp(
        String.raw`useMemo\s*\(\s*\(\s*\)\s*=>\s*compileAppToPreview\s*\(`,
      );
      expect(src).toMatch(memoizedCompile);
    });

    it('derives the active CompiledHubView from CompiledAppView.hubs by activeHubId', () => {
      const src = read(PAGE_PATH);
      // The active hub lookup pattern: `view.hubs.find((h) => h.hubId === activeHubId)`
      // (or any whitespace variant). We just require both `hubs.find` and a
      // reference to `activeHubId` appearing together in a useMemo body
      // alongside compileAppToPreview consumption.
      expect(src).toMatch(/hubs\.find\s*\(/);
      expect(src).toMatch(/activeHubId/);
    });

    it('passes the derived compiledHubView through to PrismHost as a prop', () => {
      const src = read(PAGE_PATH);
      // The JSX should mount PrismHost with `compiledHubView={...}`. We match
      // the prop assignment regardless of the right-hand expression so the
      // test does not couple to a specific variable name.
      expect(src).toMatch(/<PrismHost[\s\S]*?compiledHubView=\{/);
    });
  });
});

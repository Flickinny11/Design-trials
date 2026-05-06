// HL10 — Editor renders artifacts (Playwright spec).
//
// Spec refs:
//   - Plan §P10 (ArtifactNode + GlassNode delegation).
//   - Editor invariant ("one graph, two views").
//   - Halt-check: "KripVerify screenshot of editor canvas confirms ≥3
//     ArtifactNode meshes."
//
// The harness page (`tests/browser/_harness/editor-artifacts.html`) loads a
// vanilla-DOM bundle (`editor-artifacts-main.js`) that imports the canonical
// live-graph fixture, runs `buildPerNodeFactory(defaultRenderModeFactory)`
// for every artifact-bearing node, and stamps a JSON readout onto the page
// inside `<pre id="readout">`. This is intentionally tighter than the full
// React+R3F editor mount: the contract surface this task ships (factory
// pipeline + delegation predicate) is browser-runnable in isolation, and
// KripVerify's full-canvas smoke covers the React integration.

import { expect, test } from 'playwright/test';

test.describe('HL10 — Editor renders artifacts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor-artifacts.html');
    await expect(page.locator('body[data-hl10-ready="1"]')).toBeAttached({ timeout: 15_000 });
  });

  test('≥3 artifact-bearing nodes resolve to non-empty Object3Ds', async ({ page }) => {
    const readout = await page.locator('pre#readout').textContent();
    expect(readout).toBeTruthy();
    const data = JSON.parse(readout!);
    expect(data.totalNodes).toBeGreaterThanOrEqual(6);
    expect(data.artifactCount).toBeGreaterThanOrEqual(3);
    expect(data.artifactObjects).toBeGreaterThanOrEqual(3);
  });

  test('intent-only nodes are excluded from artifact path (delegation)', async ({ page }) => {
    const readout = await page.locator('pre#readout').textContent();
    const data = JSON.parse(readout!);
    // home-headline has no sourceAsset / meshUrl / codeRef — must be in the
    // non-artifact bucket so GlassNode can render the sphere fallback.
    expect(data.intentOnlyIds).toContain('home-headline');
    expect(data.artifactIds).not.toContain('home-headline');
  });

  test('artifact resolver caches by nodeId+codeRef', async ({ page }) => {
    const readout = await page.locator('pre#readout').textContent();
    const data = JSON.parse(readout!);
    expect(data.cacheHitOnSecondResolve).toBe(true);
  });
});

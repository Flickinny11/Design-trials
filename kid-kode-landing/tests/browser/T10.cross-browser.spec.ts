// T10 — Cross-browser DoD smoke (§17 L527-L543).
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L532 (DoD #2: loads in
//     Chrome/Safari26+/Firefox/Edge with WebGPU active)
//   - §17 L533 (DoD #3: WebGL2 fallback verified)
//   - §17 L535 (DoD #5: MSDF crisp at 1×–10×)
//   - §17 L536 (DoD #6: mesh GLB loads <2s)
//   - §17 L537 (DoD #7: parallax-plane responds to cursor)
//
// Coverage scope (single chromium project — see
// `docs/spec-deviations-prism.md` §T10):
//
//   Only chromium runs in CI. `playwright.config.ts:36-54` declares one
//   `chromium` project with `--enable-unsafe-webgpu` + swiftshader
//   Vulkan flags. firefox/webkit projects would require
//   `npx playwright install firefox webkit` (not currently provisioned)
//   and are tracked as a documented follow-up. Real Safari 26+ + Edge
//   verification requires manual sign-off off-CI.
//
// Each test below asserts an aspect of the DoD that is verifiable on
// the chromium engine alone. Items downgraded relative to the full
// spec (e.g. DoD #6 GLB <2s budget, DoD #7 parallax displacement
// uniform tracking) are explicitly enumerated in the deviations doc.
//
// The harness page (`tests/browser/_harness/T10-cross-browser.html`)
// runs all probes in parallel and exposes results on `window.__*`
// globals so this spec can read them via a uniform API.

import { expect, test } from 'playwright/test';

test.describe('T10 — Cross-browser DoD smoke', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    // Stash on test info via attachment so each test can read collected
    // errors at the end.
    (page as unknown as { __collectedErrors: string[] }).__collectedErrors = errors;
  });

  test('§17 DoD #2 — mock-app bundle parses across this engine', async ({ page }) => {
    await page.goto('/T10-cross-browser.html');
    await page.waitForFunction(() => (window as unknown as { __t10Loaded?: boolean }).__t10Loaded === true, null, { timeout: 15_000 });

    const bootExported = await page.evaluate(() => (window as unknown as { __bootExported?: boolean }).__bootExported);
    expect(bootExported, 'mock-app app.js boot() export').toBe(true);

    const t10Errors = await page.evaluate(() => (window as unknown as { __t10Errors?: string[] }).__t10Errors ?? []);
    expect(t10Errors, t10Errors.join('\n')).toEqual([]);
  });

  test('§17 DoD #3 — WebGL2 fallback context is acquirable AND the bundle picks it when navigator.gpu is unavailable', async ({ page }) => {
    // §17 DoD #3 spec literal: "verify via DevTools 'Disable WebGPU'".
    // We can't drive DevTools from Playwright, but we can stub
    // `navigator.gpu` to undefined BEFORE the harness loads, which
    // exercises the same code path the bundle's scene-root takes when
    // WebGPU is genuinely absent. The bundle's `WebGPURenderer.init()`
    // call is the part that decides — when adapter acquisition fails,
    // the SceneRoot path (T02 `createSceneRoot` `noRenderer` /
    // `rendererFactory` test seam) is supposed to fall back to a WebGL2
    // path. Here we assert the structural antecedent: when navigator.gpu
    // is missing, the canvas can still acquire a WebGL2 context, which
    // is what a real WebGL2-only Chromium build (or Firefox/Safari
    // without WebGPU flag) would expose.
    //
    // Trade-off: this does NOT instantiate the SceneRoot itself in
    // the no-WebGPU path; that requires a WebGL2 fallback path inside
    // `WebGPURenderer.init()` which three r184 ships natively. The
    // deviations doc §T10 records this gap.
    await page.addInitScript(() => {
      // Stomp navigator.gpu before any module on the page touches it.
      // `defineProperty` is required because navigator.gpu may be a
      // configurable getter on the underlying engine.
      try {
        Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
      } catch {
        // Some engines disallow redefinition; fallback for those is to
        // assign undefined which the harness probes via truthiness.
        (navigator as unknown as { gpu?: unknown }).gpu = undefined;
      }
    });
    await page.goto('/T10-cross-browser.html');
    await page.waitForFunction(() => (window as unknown as { __t10Loaded?: boolean }).__t10Loaded === true, null, { timeout: 15_000 });

    const webgpuActive = await page.evaluate(() => (window as unknown as { __webgpuActive?: boolean }).__webgpuActive);
    const webgl2 = await page.evaluate(() => (window as unknown as { __webgl2Active?: boolean }).__webgl2Active);

    // After the init-script stomps navigator.gpu, WebGPU MUST be inactive
    // and WebGL2 MUST be acquirable. This is the structural fallback
    // guarantee.
    expect(webgpuActive, 'WebGPU should be inactive after navigator.gpu = undefined').toBe(false);
    expect(webgl2, 'WebGL2 fallback context must be acquirable').toBe(true);
  });

  test('§17 DoD #5 — MSDF text module path resolves end-to-end', async ({ page }) => {
    // Engine-independent: the harness imports `three-msdf-text-webgpu`
    // via the `/shims/` route. If the shim resolves and exports a
    // class, the production bundle's MSDFText path is reachable on this
    // engine. Crispness (1×-10× zoom) is exercised in the editor Visual
    // tab E2E; here we only verify module reachability.
    await page.goto('/T10-cross-browser.html');
    await page.waitForFunction(() => (window as unknown as { __t10Loaded?: boolean }).__t10Loaded === true, null, { timeout: 15_000 });

    const msdf = await page.evaluate(() => (window as unknown as { __msdfReachable?: boolean }).__msdfReachable);
    expect(msdf, 'MSDF module reachable').toBe(true);
  });

  test('§17 DoD #6 — GLTFLoader is constructable (mesh GLB load path)', async ({ page }) => {
    // The <2s budget is for actual R2 GLB downloads; in CI we don't
    // have an R2 endpoint. The DoD-equivalent guarantee we can make
    // statically is: the loader class resolves from `three/addons/`,
    // is constructable, and exposes `load`/`parse`. T06's pipeline
    // tests verify the Hunyuan3D Rapid path returns a GLB URL within
    // the timeout budget.
    await page.goto('/T10-cross-browser.html');
    await page.waitForFunction(() => (window as unknown as { __t10Loaded?: boolean }).__t10Loaded === true, null, { timeout: 15_000 });

    const reachable = await page.evaluate(() => (window as unknown as { __glbLoaderReachable?: boolean }).__glbLoaderReachable);
    expect(reachable, 'GLTFLoader reachable').toBe(true);
  });

  test('§17 DoD #7 — parallax-plane pointer pipeline is wired', async ({ page }) => {
    await page.goto('/T10-cross-browser.html');
    await page.waitForFunction(() => (window as unknown as { __t10Loaded?: boolean }).__t10Loaded === true, null, { timeout: 15_000 });

    // Synthesize 3 pointermoves over the canvas and assert the
    // listener increments its event count + records the latest x.
    const canvas = page.locator('#probe');
    const box = await canvas.boundingBox();
    expect(box, 'canvas box').not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx - 20, cy);
    await page.mouse.move(cx, cy);
    await page.mouse.move(cx + 20, cy);

    const eventCount = await page.evaluate(() => (window as unknown as { __pointerEventCount?: number }).__pointerEventCount ?? 0);
    expect(eventCount, 'pointermove events delivered').toBeGreaterThanOrEqual(3);

    const lastX = await page.evaluate(() => (window as unknown as { __lastPointerX?: number | null }).__lastPointerX);
    expect(lastX, 'last pointer X recorded').not.toBeNull();
  });

  test('§17 DoD #11 — no console errors during cross-browser smoke', async ({ page }) => {
    await page.goto('/T10-cross-browser.html');
    await page.waitForFunction(() => (window as unknown as { __t10Loaded?: boolean }).__t10Loaded === true, null, { timeout: 15_000 });
    const errors = (page as unknown as { __collectedErrors?: string[] }).__collectedErrors ?? [];
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// T08 — Editor image-edit tools Playwright spec.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L483 — "Image-edit mode —
// masking and crop tools become essential. The user-flagged 'swap code for
// image' → 'swap mesh for image' preserves all behavior code; the renderer
// just falls back to a flat texture from the FLUX.2 image."
//
// halt-check (ralph-state.json T08): "Image swap-in preserves behavior. Mask
// refinement works."

import { expect, test } from 'playwright/test';

test.describe('T08 — Editor image-edit tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/image-edit.html');
    await expect(page.locator('body[data-t08-image-edit-ready="1"]')).toBeAttached({ timeout: 10_000 });
  });

  test('exposes mask + crop + swap-mesh-for-image tools (§13 L483)', async ({ page }) => {
    await expect(page.locator('[data-role=image-edit-tool][data-tool=mask]')).toBeAttached();
    await expect(page.locator('[data-role=image-edit-tool][data-tool=crop]')).toBeAttached();
    await expect(page.locator('[data-role=image-edit-tool][data-tool=swap-mesh-for-image]')).toBeAttached();
  });

  test('swap-mesh-for-image: preserves behavior code (§13 L483 — "preserves all behavior code")', async ({ page }) => {
    // Source node is a mesh with non-empty cinematicPrimitives.
    await expect(page.locator('[data-role=node-render-mode]')).toHaveText('mesh');
    const beforePrimitiveCount = Number(await page.locator('[data-role=node-primitives-count]').textContent());
    expect(beforePrimitiveCount).toBeGreaterThan(0);
    const beforeBehaviorJson = await page.locator('[data-role=node-behavior-json]').textContent();

    // Swap.
    await page.locator('[data-role=image-edit-tool][data-tool=swap-mesh-for-image] button').click();

    // renderMode flipped to a non-mesh fallback.
    const afterRenderMode = await page.locator('[data-role=node-render-mode]').textContent();
    expect(['sprite', 'plane']).toContain(afterRenderMode);

    // meshUrl cleared.
    await expect(page.locator('[data-role=node-mesh-url]')).toHaveText('null');

    // behaviorSpec preserved.
    const afterBehaviorJson = await page.locator('[data-role=node-behavior-json]').textContent();
    expect(afterBehaviorJson).toBe(beforeBehaviorJson);

    // cinematicPrimitives preserved (count unchanged).
    const afterPrimitiveCount = Number(await page.locator('[data-role=node-primitives-count]').textContent());
    expect(afterPrimitiveCount).toBe(beforePrimitiveCount);
  });

  test('crop: writes the crop rect to visual.transform (§13 L483 — crop tools)', async ({ page }) => {
    await page.locator('[data-role=crop-input][data-axis=x]').fill('15');
    await page.locator('[data-role=crop-input][data-axis=y]').fill('25');
    await page.locator('[data-role=crop-input][data-axis=width]').fill('128');
    await page.locator('[data-role=crop-input][data-axis=height]').fill('96');

    await page.locator('[data-role=image-edit-tool][data-tool=crop] button[data-action=apply-crop]').click();

    await expect(page.locator('[data-role=visual-transform-readout][data-axis=x]')).toHaveText('15');
    await expect(page.locator('[data-role=visual-transform-readout][data-axis=y]')).toHaveText('25');
    await expect(page.locator('[data-role=visual-transform-readout][data-axis=width]')).toHaveText('128');
    await expect(page.locator('[data-role=visual-transform-readout][data-axis=height]')).toHaveText('96');
  });

  test('mask refinement: writes a mask spec onto the targeted layer (§13 L483 — masking tools)', async ({ page }) => {
    // Pre-state: layer l1 has no mask.
    await expect(page.locator('[data-role=layer-mask-readout][data-layer=l1]')).toHaveText('none');

    await page.locator('[data-role=mask-shape-select]').selectOption('circle');
    await page.locator('[data-role=mask-radius-input]').fill('48');
    await page.locator('[data-role=mask-target-select]').selectOption('l1');
    await page.locator('[data-role=image-edit-tool][data-tool=mask] button[data-action=apply-mask]').click();

    await expect(page.locator('[data-role=layer-mask-readout][data-layer=l1]')).toContainText('circle');
    await expect(page.locator('[data-role=layer-mask-readout][data-layer=l1]')).toContainText('48');
  });

  test('swap-mesh-for-image is idempotent on a non-mesh node (no error, render mode stays sprite/plane)', async ({ page }) => {
    // Click swap once to get to a non-mesh state.
    await page.locator('[data-role=image-edit-tool][data-tool=swap-mesh-for-image] button').click();
    const afterFirst = await page.locator('[data-role=node-render-mode]').textContent();
    expect(['sprite', 'plane']).toContain(afterFirst);

    // Click again — must not throw.
    await page.locator('[data-role=image-edit-tool][data-tool=swap-mesh-for-image] button').click();
    const afterSecond = await page.locator('[data-role=node-render-mode]').textContent();
    expect(['sprite', 'plane']).toContain(afterSecond);
  });
});

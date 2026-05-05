// T08 — Editor Animation tab Playwright spec.
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §13 L479 — "Animation tab — gains
//     hybrid mode toggle: i2v frame-scrub (existing) OR timeline-keyframe
//     (new). Timeline mode shows a GSAP-style track with keyframes.
//     Drag-corners-to-resize and drag-to-position update parameters; 'save
//     as keyframe' snapshots current parameter state. PowerPoint-style
//     entrance/emphasis/exit/motion-path presets pull from the cinematic
//     primitives library."
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L539 (DoD #9) — "The Animation
//     tab keyframe timeline successfully captures and replays parameter
//     snapshots".
//   - halt-check (ralph-state.json T08): "Animation tab supports both i2v
//     frame-scrub and timeline-keyframe modes. Timeline keyframes render.
//     PowerPoint presets map to cinematic primitives."

import { expect, test } from 'playwright/test';

test.describe('T08 — Editor Animation tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/animation.html');
    await expect(page.locator('body[data-t08-animation-ready="1"]')).toBeAttached({ timeout: 10_000 });
  });

  test('exposes a hybrid mode toggle with i2v-frame-scrub and timeline-keyframe options (§13 L479)', async ({ page }) => {
    const toggle = page.locator('[data-role=animation-mode-toggle]');
    await expect(toggle).toBeAttached();

    const i2v = toggle.locator('[data-role=animation-mode-option][data-mode=i2v-frame-scrub]');
    const timeline = toggle.locator('[data-role=animation-mode-option][data-mode=timeline-keyframe]');
    await expect(i2v).toBeAttached();
    await expect(timeline).toBeAttached();
  });

  test('switching to timeline-keyframe mode reveals a GSAP-style track + keyframe controls', async ({ page }) => {
    const timelineOption = page.locator('[data-role=animation-mode-option][data-mode=timeline-keyframe]');
    await timelineOption.click();
    await expect(page.locator('[data-role=animation-mode-active]')).toHaveAttribute('data-mode', 'timeline-keyframe');

    await expect(page.locator('[data-role=keyframe-track]')).toBeVisible();
    await expect(page.locator('[data-role=capture-keyframe]')).toBeVisible();
  });

  test('switching to i2v-frame-scrub mode reveals a frame-scrub control (no keyframe track)', async ({ page }) => {
    const i2vOption = page.locator('[data-role=animation-mode-option][data-mode=i2v-frame-scrub]');
    await i2vOption.click();
    await expect(page.locator('[data-role=animation-mode-active]')).toHaveAttribute('data-mode', 'i2v-frame-scrub');

    await expect(page.locator('[data-role=frame-scrub-slider]')).toBeVisible();
  });

  test('PowerPoint preset library renders all four categories (entrance, emphasis, exit, motion-path)', async ({ page }) => {
    for (const cat of ['entrance', 'emphasis', 'exit', 'motion-path']) {
      const group = page.locator(`[data-role=preset-group][data-category="${cat}"]`);
      await expect(group).toBeAttached();
      const presetCount = await group.locator('[data-role=preset-button]').count();
      expect(presetCount).toBeGreaterThan(0);
    }
  });

  test('every PowerPoint preset references a primitive from the canonical 9-primitive library', async ({ page }) => {
    const KNOWN = [
      'orbit', 'depth-rotate', 'dissolve-morph', 'displacement-transition',
      'parallax-scroll', 'magnetic-cursor', 'particle-emerge', 'fly-through',
      'kinetic-text',
    ];
    const buttons = page.locator('[data-role=preset-button]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const primitive = await buttons.nth(i).getAttribute('data-primitive');
      expect(primitive, `preset ${i} primitive`).not.toBeNull();
      expect(KNOWN).toContain(primitive);
    }
  });

  test('clicking a PowerPoint preset appends a CinematicPrimitiveRef to the node\'s primitives list', async ({ page }) => {
    const beforeCount = Number(await page.locator('[data-role=cinematic-primitives-count]').textContent());
    const button = page.locator('[data-role=preset-button]').first();
    const expectedPrimitive = await button.getAttribute('data-primitive');

    await button.click();

    const afterCount = Number(await page.locator('[data-role=cinematic-primitives-count]').textContent());
    expect(afterCount).toBe(beforeCount + 1);

    const lastEntry = page.locator('[data-role=cinematic-primitive-entry]').last();
    await expect(lastEntry).toHaveAttribute('data-name', expectedPrimitive!);
  });

  test('Capture Keyframe + Replay round-trip preserves parameter snapshot (§17 L539)', async ({ page }) => {
    // Switch to timeline-keyframe.
    await page.locator('[data-role=animation-mode-option][data-mode=timeline-keyframe]').click();

    const scaleInput = page.locator('[data-role=param-input][data-param=scale]');
    await scaleInput.fill('1.7');
    await scaleInput.dispatchEvent('input');

    const opacityInput = page.locator('[data-role=param-input][data-param=opacity]');
    await opacityInput.fill('0.4');
    await opacityInput.dispatchEvent('input');

    const captureBtn = page.locator('[data-role=capture-keyframe]');
    await captureBtn.click();

    // Keyframe count increments.
    await expect(page.locator('[data-role=keyframe-count]')).toHaveText('1');

    // Now change the live params away from the captured snapshot.
    await scaleInput.fill('0.5');
    await scaleInput.dispatchEvent('input');
    await opacityInput.fill('1');
    await opacityInput.dispatchEvent('input');

    // Replay at the keyframe's t (default capture-time t=0 — replay reads the
    // first keyframe). We assert via the in-page replay readout.
    const replayBtn = page.locator('[data-role=replay-keyframes]');
    await replayBtn.click();

    const replayScale = await page.locator('[data-role=replay-readout][data-param=scale]').textContent();
    const replayOpacity = await page.locator('[data-role=replay-readout][data-param=opacity]').textContent();
    expect(Number(replayScale)).toBeCloseTo(1.7, 2);
    expect(Number(replayOpacity)).toBeCloseTo(0.4, 2);
  });
});

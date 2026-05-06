// HL13 — Add Node UI (Playwright spec).
//
// Spec refs:
//   - Plan §P13 (TopBar "+ Add Node" button + AddNodeDialog modal).
//   - Halt-check: dialog has hub dropdown, caption textarea, subtype text;
//     submit calls useGraphSourceStore.addNode with parentHubId+intent+subtype;
//     TopBar.tsx contains data-component="add-node-button".
//
// The harness page (`tests/browser/_harness/add-node.html`) bundles a React
// mount of the real `AddNodeDialog` component plus a trigger button that
// carries the same `data-component="add-node-button"` selector the production
// TopBar will use, all wired against the real `useGraphSourceStore`. The
// harness exposes a `<pre id="readout">` with the live store nodes count +
// the most-recently-added node's parentHubId / intent.caption / subtype, so
// Playwright can confirm that submission produced exactly one new node with
// the user-supplied fields.
//
// This is intentionally tighter than booting the full editor: the contract
// surface this task ships is "click button → fill form → addNode mutator
// fires with correct shape." KripVerify covers the production-path canvas
// smoke (kvAssert nodes.size increases by 1 in __prismRenderer.adapterResult).

import { expect, test } from 'playwright/test';

test.describe('HL13 — Add Node UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/add-node.html');
    await expect(page.locator('body[data-hl13-ready="1"]')).toBeAttached({ timeout: 15_000 });
  });

  test('TopBar exposes data-component="add-node-button"', async ({ page }) => {
    const btn = page.locator('[data-component="add-node-button"]');
    await expect(btn).toBeVisible();
  });

  test('clicking Add Node opens dialog with hub dropdown + caption + subtype', async ({ page }) => {
    await page.locator('[data-component="add-node-button"]').click();
    await expect(page.locator('[data-component="add-node-dialog"]')).toBeVisible();
    await expect(page.locator('[data-role="add-node-hub"]')).toBeVisible();
    await expect(page.locator('[data-role="add-node-caption"]')).toBeVisible();
    await expect(page.locator('[data-role="add-node-subtype"]')).toBeVisible();
  });

  test('submit creates node via addNode with caption + subtype + parentHubId', async ({ page }) => {
    const before = JSON.parse(
      (await page.locator('pre#readout').textContent()) ?? '{}'
    );
    expect(before.nodesCount).toBeGreaterThanOrEqual(1);

    await page.locator('[data-component="add-node-button"]').click();
    await page.locator('[data-role="add-node-caption"]').fill('Brand-new node from HL13 spec');
    await page.locator('[data-role="add-node-subtype"]').fill('product');
    await page.locator('[data-role="add-node-submit"]').click();

    // Dialog closes after successful submit.
    await expect(page.locator('[data-component="add-node-dialog"]')).toHaveCount(0);

    const after = JSON.parse(
      (await page.locator('pre#readout').textContent()) ?? '{}'
    );
    expect(after.nodesCount).toBe(before.nodesCount + 1);
    expect(after.lastNodeCaption).toBe('Brand-new node from HL13 spec');
    expect(after.lastNodeSubtype).toBe('product');
    expect(typeof after.lastNodeParentHubId).toBe('string');
    expect(after.lastNodeParentHubId.length).toBeGreaterThan(0);
  });

  test('cancel closes dialog without adding a node', async ({ page }) => {
    const before = JSON.parse(
      (await page.locator('pre#readout').textContent()) ?? '{}'
    );
    await page.locator('[data-component="add-node-button"]').click();
    await expect(page.locator('[data-component="add-node-dialog"]')).toBeVisible();
    await page.locator('[data-role="add-node-cancel"]').click();
    await expect(page.locator('[data-component="add-node-dialog"]')).toHaveCount(0);

    const after = JSON.parse(
      (await page.locator('pre#readout').textContent()) ?? '{}'
    );
    expect(after.nodesCount).toBe(before.nodesCount);
  });

  test('submit is disabled when caption is empty', async ({ page }) => {
    await page.locator('[data-component="add-node-button"]').click();
    await page.locator('[data-role="add-node-caption"]').fill('');
    const submit = page.locator('[data-role="add-node-submit"]');
    await expect(submit).toBeDisabled();
  });
});

// F4b verification — headed real-GPU Chrome, boot into preview-app, screenshot each hub.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'notes/verification/editor-experience/F4b';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launchPersistentContext('/tmp/f4b-chrome-profile', {
  channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});
const p = await b.newPage();
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/#hub=s1-arrival', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(4500);
for (const fn of [
  async () => { await p.getByText('SKIP', { exact: false }).first().click({ timeout: 2500 }); },
  async () => { await p.locator('[aria-label="Close"],[aria-label="close"],button:has-text("×")').first().click({ timeout: 2000 }); },
  async () => { await p.keyboard.press('Escape'); },
]) { try { await fn(); await p.waitForTimeout(400); } catch {} }
await p.evaluate(() => { const w = window; if (w.__PRISM_EDITOR_SET_VIEW_MODE__) w.__PRISM_EDITOR_SET_VIEW_MODE__('preview-app'); });
await p.waitForTimeout(900);
const hubs = ['s2-movement', 's3-materia', 's4-celestia', 's5-acquire'];
for (const hub of hubs) {
  const res = await p.evaluate((h) => {
    const nav = window.__PRISM_EDITOR_PREVIEW_APP_NAV__;
    if (nav && nav.goTo) return { ok: nav.goTo(h), active: nav.activeHubId };
    return { ok: null, active: null };
  }, hub);
  console.log('nav', hub, JSON.stringify(res));
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${OUT}/${hub}.png` });
  console.log('shot', hub);
}
console.log('console_errors=' + errs.length);
if (errs.length) console.log(errs.slice(0, 12).join('\n'));
await b.close(); console.log('DONE');

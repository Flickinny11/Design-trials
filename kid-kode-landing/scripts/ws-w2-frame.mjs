// Framed inspector-dock capture (the dock sits at the right frame edge, so we
// move the editor review camera to frame it) — for visual judgment of the W-2
// in-engine glass tabs. Headless. Usage: node scripts/ws-w2-frame.mjs [section...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/ws-w2';
mkdirSync(OUT, { recursive: true });
const sections = process.argv.slice(2).length ? process.argv.slice(2) : ['purpose', 'functions', 'integrations', 'data'];

const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1680, height: 1000 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(
  () => typeof window.__PRISM_EDITOR_CAPABILITY__ === 'object' && window.__PRISM_EDITOR_SHELL_STORE__ && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0,
  { timeout: 90000 },
);
await p.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
await p.waitForTimeout(2000);
await p.evaluate(() => {
  const s = window.__PRISM_EDITOR_SHELL_STORE__();
  window.__PRISM_EDITOR_SELECT__(s.activeHubNodeIds[0] || s.allNodeIds[0]);
});
await p.waitForTimeout(600);
await p.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, 0.4, 10.5, 11.7, 0.4, 1));
await p.waitForTimeout(400);
for (const sec of sections) {
  await p.evaluate((s) => window.__PRISM_EDITOR_CAPABILITY__.setSection(s), sec);
  await p.waitForTimeout(550);
  await p.screenshot({ path: `${OUT}/dock-${sec}.png` });
  console.log('captured', sec);
}
await b.close();
console.log('done');

// Focused diagnostic: reproduce the null artifactFrameRect on early steps.
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 4899);
const URL = `http://localhost:${PORT}/`;
const VP = process.env.VP || 'mobile';
const dims = VP === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: dims, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });
page.on('pageerror', (e) => console.log('PAGEERR:', e.message.slice(0, 160)));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 30000 }).catch(() => {});
await sleep(4500);

const dump = async (label) => {
  const d = await page.evaluate(() => ({
    tip: window.__PRISM_TIPS__?.state?.() ?? null,
    pub: window.__TIP_PUB__ ?? null,
    art: window.__TIP_ART_DBG__ ?? null,
    winRect: (() => { const e = document.querySelector('[data-component="tip-artifact-window"]'); if (!e) return 'NO-EL'; const r = e.getBoundingClientRect(); return { x: +r.left.toFixed(0), y: +r.top.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) }; })(),
    popupRect: (() => { const e = document.querySelector('[data-component="tip-popup"]'); if (!e) return 'NO-EL'; const r = e.getBoundingClientRect(); return { x: +r.left.toFixed(0), y: +r.top.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) }; })(),
  }));
  console.log(`\n[${label}] status=${d.tip?.status} step=${d.tip?.stepId}(${d.tip?.stepIndex}) storeRect=${JSON.stringify(d.tip?.artifactFrameRect)}`);
  console.log(`   winEl=${JSON.stringify(d.winRect)}  popupEl=${JSON.stringify(d.popupRect)}`);
  console.log(`   __TIP_PUB__=${JSON.stringify(d.pub)}`);
  console.log(`   __TIP_ART_DBG__=${JSON.stringify(d.art)}`);
};

await page.evaluate(() => window.__PRISM_TIPS__?.clearSeen?.());
await page.evaluate(() => window.__PRISM_TIPS__?.launch?.());
await sleep(1800);
await dump('after launch (step0)');

for (let i = 0; i < 7; i++) {
  await page.evaluate((idx) => window.__PRISM_TIPS__?.goTo?.(idx), i);
  await sleep(1600);
  await dump(`goTo(${i})`);
}

await browser.close();

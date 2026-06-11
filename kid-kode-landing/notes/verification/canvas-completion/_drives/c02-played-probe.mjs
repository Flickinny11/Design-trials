// c02 follow-up — positive "played state" probe in preview-app: sample full
// matrixWorld of every descendant (up to 40/node) + material opacity over
// 1.5s; canvas mode must be still, preview-app must have movers.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/canvas-completion');
const { chromium } = await import('playwright');
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});
const results = { pass: false };
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4500);

  const probe = () => page.evaluate(async () => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    if (!m) return { error: 'no map' };
    const sig = () => {
      const out = {};
      for (const [k, g] of m) {
        const vals = [];
        let n = 0;
        g.traverse((o) => {
          if (n >= 40) return;
          n++;
          o.updateMatrixWorld?.();
          const e = o.matrixWorld?.elements;
          if (e) vals.push(e[0], e[5], e[12], e[13], e[14]);
          if (o.material && typeof o.material.opacity === 'number') vals.push(o.material.opacity);
        });
        out[k] = vals;
      }
      return out;
    };
    const a = sig();
    await new Promise((r) => setTimeout(r, 1500));
    const b = sig();
    const movers = Object.keys(a).filter((k) => {
      const va = a[k], vb = b[k];
      if (va.length !== vb.length) return true;
      let d = 0;
      for (let i = 0; i < va.length; i++) d += Math.abs(va[i] - vb[i]);
      return d > 1e-3;
    });
    return { movers, total: m.size };
  });

  // boot mode is preview-app (RA-17)
  const playing = await probe();
  results.previewApp = playing;

  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);
  const still = await probe();
  results.canvas = still;

  results.pass = (playing.movers?.length ?? 0) > 0 && (still.movers?.length ?? 0) === 0;
} catch (e) {
  results.error = String(e?.message ?? e);
} finally {
  await browser.close();
  await writeFile(path.join(OUT, 'c02-played-state-probe.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);

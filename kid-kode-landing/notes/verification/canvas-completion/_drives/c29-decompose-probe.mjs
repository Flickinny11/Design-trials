// crit-29 supplement — per-glyph/word/line unit granularity LIVE probe.
// The c29-results.json drive proved per-GLYPH animation on the shared timeline
// + Driver swap (INV-6). This probe proves the same text object re-decomposes
// into WORD and LINE animation units live (contract.ts: one Mesh per unit),
// which is what every text-category primitive animates.
// Run: node notes/verification/canvas-completion/_drives/c29-decompose-probe.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/canvas-completion');
const results = { steps: [], consoleErrors: [], pass: false };
const ok = (step, extra = {}) => results.steps.push({ step, ok: true, ...extra });
const fail = (msg) => { results.steps.push({ step: msg, ok: false }); throw new Error(msg); };

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 300)); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);
  results.rendererBackend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');

  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.click('[data-tool-group="text"]');
  await page.waitForTimeout(600);

  const nodesBefore = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  await page.getByRole('button', { name: /Add Text/ }).click();
  await page.waitForTimeout(1500);

  const countUnits = (before) => page.evaluate((prev) => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    if (!m) return { error: 'no map' };
    const ids = [...m.keys()].filter((k) => !prev.includes(k));
    for (const id of ids.length ? ids : [...m.keys()]) {
      const g = m.get(id);
      let handle = null; let units = 0;
      g.traverse((o) => {
        if (o.userData?.textHandle) handle = o;
        if (/^glyph-\d+$/.test(o.name) && o.isMesh) units++;
      });
      if (handle) return { nodeId: id, units, decompose: handle.userData.textHandle.spec.decompose ?? 'glyph', content: handle.userData.textHandle.spec.content };
    }
    return { error: 'no textHandle node' };
  }, before);

  // Multi-word, multi-line content so the three granularities are distinguishable.
  await page.fill('[data-control="text-content"]', 'ONE TWO\nTHREE');
  await page.waitForTimeout(900);

  const glyphMode = await countUnits(nodesBefore);
  if (glyphMode.error) fail('add-text/glyph count failed: ' + glyphMode.error);
  ok('decompose=glyph: one unit mesh per glyph', glyphMode);
  await page.screenshot({ path: path.join(OUT, 'c29-decompose-glyph.png') });

  await page.click('[data-testid="text-decompose-word"]');
  await page.waitForTimeout(900);
  const wordMode = await countUnits(nodesBefore);
  ok('decompose=word: one unit mesh per word', wordMode);
  await page.screenshot({ path: path.join(OUT, 'c29-decompose-word.png') });

  await page.click('[data-testid="text-decompose-line"]');
  await page.waitForTimeout(900);
  const lineMode = await countUnits(nodesBefore);
  ok('decompose=line: one unit mesh per line', lineMode);
  await page.screenshot({ path: path.join(OUT, 'c29-decompose-line.png') });

  const exp = { glyph: 11, word: 3, line: 2 }; // 'ONE TWO\nTHREE' = 11 glyphs / 3 words / 2 lines
  results.expected = exp;
  results.pass =
    glyphMode.units === exp.glyph && glyphMode.decompose === 'glyph' &&
    wordMode.units === exp.word && wordMode.decompose === 'word' &&
    lineMode.units === exp.line && lineMode.decompose === 'line' &&
    results.consoleErrors.length === 0;
  if (!results.pass) results.steps.push({ step: 'unit-count expectations', ok: false, glyphMode, wordMode, lineMode });

  await writeFile(path.join(OUT, 'c29-decompose-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass: results.pass, glyph: glyphMode, word: wordMode, line: lineMode, backend: results.rendererBackend, consoleErrors: results.consoleErrors.length }));
  process.exitCode = results.pass ? 0 : 1;
} catch (e) {
  results.error = String(e);
  await writeFile(path.join(OUT, 'c29-decompose-results.json'), JSON.stringify(results, null, 2)).catch(() => {});
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  await browser.close();
}

// F3 re-check v4 — robust: enter canvas ONCE via DOM toggle, then drive
// Flow 6 (gizmo) + Flow 9 (text tool) via DOM selectors only. Avoids the
// store-remount race seen when calling page.evaluate during mode switches.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'notes/verification/editor-experience/F3-FUNCTIONAL';
const log = (...a) => console.log(...a);
const errs = [];
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
const settle = (ms = 1500) => p.waitForTimeout(ms);
const shot = async (n) => { await p.screenshot({ path: `${OUT}/${n}.png` }); return n + '.png'; };
// store reads are wrapped so a transient missing-store never throws
const safeEval = async (fn, arg) => { try { return await p.evaluate(fn, arg); } catch (e) { return { _err: String(e).slice(0, 80) }; } };

await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await settle(5500);
for (const fn of [
  async () => { await p.getByText('SKIP', { exact: false }).first().click({ timeout: 2500 }); },
  async () => { await p.keyboard.press('Escape'); }, async () => { await p.keyboard.press('Escape'); },
]) { try { await fn(); await settle(600); } catch {} }
await settle(1200);

// enter Canvas via the DOM toggle (not the store)
try { await p.locator('[data-component="view-mode-toggle"]').getByRole('button', { name: 'Canvas', exact: true }).click({ timeout: 5000 }); } catch {}
await settle(3000);

// select a node via canvas click
const canvas = p.locator('canvas').first();
const box = await canvas.boundingBox();
let sel = null;
if (box) {
  for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.48], [0.55, 0.52], [0.5, 0.42], [0.5, 0.62]]) {
    await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy); await settle(1000);
    const s = await safeEval(() => window.__PRISM_DEBUG_STORES__?.graphEditor.getState().selectedNodeId ?? null);
    if (s && !s._err) { sel = s; break; }
  }
}
log('selected=' + sel);

// ===== FLOW 6 — Edit handles + Move arm + nudge X (DOM-driven) =====
{
  // open Transform group if its steppers aren't present
  if (await p.locator('[data-testid="tt-pos-x"]').count() === 0) {
    try { await p.locator('[data-tool-group="transform"]').click({ timeout: 4000 }); await settle(1200); } catch {}
  }
  // Inspector Edit button engages editorMode='edit'
  try { await p.locator('[data-role="edit-toggle"]').first().click({ timeout: 4000 }); await settle(1000); } catch {}
  // arm Move
  try { await p.locator('[data-testid="tt-move"]').click({ timeout: 3000 }); await settle(800); } catch {}
  const st1 = await safeEval(() => { const e = window.__PRISM_DEBUG_STORES__?.graphEditor.getState(); return e ? { editorMode: e.editorMode, gizmo: e.canvasGizmoMode } : null; });
  await shot('06r-armed');
  const xBefore = await safeEval((id) => { const ps = window.__PRISM_DEBUG_STORES__?.previewState.getState().peek(id); const n = window.__PRISM_DEBUG_STORES__?.graphSource.getState().nodes.find((x)=>x.nodeId===id); return (ps?.scenePosition?.x ?? n?.scenePosition?.x) ?? 0; }, sel);
  // click the increment (last) button of the X stepper a few times
  try {
    const btns = p.locator('[data-testid="tt-pos-x"] button');
    const c = await btns.count();
    for (let i = 0; i < 5; i++) { await btns.nth(c - 1).click({ timeout: 2000 }); await settle(350); }
  } catch (e) { log('nudgeErr ' + String(e).slice(0, 80)); }
  await settle(1000);
  const xAfter = await safeEval((id) => { const ps = window.__PRISM_DEBUG_STORES__?.previewState.getState().peek(id); return ps?.scenePosition?.x ?? null; }, sel);
  const bufCnt = await safeEval((id) => { const ps = window.__PRISM_DEBUG_STORES__?.previewState.getState().patches[id]; return ps ? Object.keys(ps).length : 0; }, sel);
  await shot('06r-after-nudge');
  log(`FLOW6 ${JSON.stringify(st1)} xBefore=${JSON.stringify(xBefore)} xAfter=${JSON.stringify(xAfter)} bufCnt=${JSON.stringify(bufCnt)}`);
  try { await p.locator('[data-testid="inspector-discard"]').click({ timeout: 2000 }); await settle(800); } catch {}
}

// ===== FLOW 9 — Add Text reveals the text-content textarea =====
{
  // open Text group
  try { await p.locator('[data-tool-group="text"]').click({ timeout: 4000 }); await settle(1200); } catch {}
  await shot('09r-text-flyout');
  let added = false;
  try { await p.getByRole('button', { name: /Add Text/i }).first().click({ timeout: 4000 }); await settle(2000); added = true; } catch (e) { log('addTextErr ' + String(e).slice(0, 80)); }
  await settle(800);
  const ta = p.locator('[data-control="text-content"]');
  const taCount = await ta.count();
  let visible = false, editable = false, clipped = null, bb = null;
  if (taCount > 0) {
    visible = await ta.first().isVisible().catch(() => false);
    bb = await ta.first().boundingBox().catch(() => null);
    if (bb) clipped = !(bb.x >= -2 && bb.y >= -2 && (bb.x + bb.width) <= 1442 && (bb.y + bb.height) <= 902 && bb.width > 40 && bb.height > 8);
    try { await ta.first().fill('Hello Prism F3'); await settle(500); const v = await ta.first().inputValue(); editable = v === 'Hello Prism F3'; } catch (e) { log('fillErr ' + String(e).slice(0, 80)); }
  }
  await shot('09r-text-content');
  log(`FLOW9 addText=${added} taCount=${taCount} visible=${visible} editable=${editable} clipped=${clipped} bbox=${bb ? JSON.stringify(bb) : null}`);
}

fs.writeFileSync(`${OUT}/_recheck-errs.json`, JSON.stringify({ count: errs.length, errs }, null, 2));
log('RECHECK_ERRS=' + errs.length);
await b.close();
log('RECHECK_DONE');

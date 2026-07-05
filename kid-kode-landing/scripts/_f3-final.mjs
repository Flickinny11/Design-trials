// F3 final — (A) clean verify of Flow 6 (gizmo) + Flow 9 (text) on a SOURCE
// node (selected programmatically so targeting is deterministic), and
// (B) confirm the Add-Node→select→Visual-tab crash repro.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = 'notes/verification/editor-experience/F3-FUNCTIONAL';
const log = (...a) => console.log(...a);
const errs = [];
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)); });
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200)));
const settle = (ms = 1500) => p.waitForTimeout(ms);
const shot = async (n) => { await p.screenshot({ path: `${OUT}/${n}.png` }); return n + '.png'; };
const ev = async (fn, a) => { try { return await p.evaluate(fn, a); } catch (e) { return { _err: String(e).slice(0, 80) }; } };

await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await settle(5500);
for (const fn of [ async () => { await p.getByText('SKIP', { exact: false }).first().click({ timeout: 2500 }); }, async () => { await p.keyboard.press('Escape'); } ]) { try { await fn(); await settle(600); } catch {} }
await settle(1200);
await p.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, { timeout: 20000 }).catch(() => {});

// Enter canvas + select a real SOURCE node programmatically (deterministic).
await ev(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setViewMode('canvas'));
await settle(2800);
const realNode = await ev(() => {
  const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
  const nodes = window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes;
  const inHub = nodes.filter((n) => n.parentHubId === e.activeHubId && n.visual);
  return (inHub[0] || nodes.find((n) => n.visual))?.nodeId ?? null;
});
await ev((id) => window.__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), realNode);
await settle(1500);
log('realNode=' + realNode);

// ---- FLOW 6: Edit handles + Move + nudge ----
{
  if (await p.locator('[data-testid="tt-pos-x"]').count() === 0) { try { await p.locator('[data-tool-group="transform"]').click({ timeout: 4000 }); await settle(1200); } catch {} }
  try { await p.locator('[data-role="edit-toggle"]').first().click({ timeout: 4000 }); await settle(1000); } catch {}
  try { await p.locator('[data-testid="tt-move"]').click({ timeout: 3000 }); await settle(800); } catch {}
  const st = await ev(() => { const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); return { editorMode: e.editorMode, gizmo: e.canvasGizmoMode }; });
  await shot('06f-armed');
  const xBefore = await ev((id) => { const ps = window.__PRISM_DEBUG_STORES__.previewState.getState().peek(id); const n = window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((x)=>x.nodeId===id); return (ps?.scenePosition?.x ?? n?.scenePosition?.x) ?? 0; }, realNode);
  try { const btns = p.locator('[data-testid="tt-pos-x"] button'); const c = await btns.count(); for (let i=0;i<5;i++){ await btns.nth(c-1).click({timeout:2000}); await settle(350);} } catch (e) { log('nudgeErr ' + String(e).slice(0,70)); }
  await settle(900);
  const xAfter = await ev((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().peek(id)?.scenePosition?.x ?? null, realNode);
  const buf = await ev((id) => { const ps = window.__PRISM_DEBUG_STORES__.previewState.getState().patches[id]; return ps ? Object.keys(ps).length : 0; }, realNode);
  await shot('06f-after-nudge');
  log(`FLOW6 ${JSON.stringify(st)} x ${JSON.stringify(xBefore)}->${JSON.stringify(xAfter)} buf=${JSON.stringify(buf)}`);
  try { await p.locator('[data-testid="inspector-discard"]').click({ timeout: 2000 }); await settle(700); } catch {}
}

// ---- FLOW 9: Add Text reveals text-content textarea ----
{
  try { await p.locator('[data-tool-group="text"]').click({ timeout: 4000 }); await settle(1200); } catch {}
  await shot('09f-flyout');
  let added = false;
  try { await p.getByRole('button', { name: /Add Text/i }).first().click({ timeout: 4000 }); await settle(2200); added = true; } catch (e) { log('addTextErr ' + String(e).slice(0,70)); }
  await settle(800);
  const ta = p.locator('[data-control="text-content"]');
  const cnt = await ta.count();
  let visible=false, editable=false, clipped=null, bb=null;
  if (cnt>0) {
    visible = await ta.first().isVisible().catch(()=>false);
    bb = await ta.first().boundingBox().catch(()=>null);
    if (bb) clipped = !(bb.x>=-2 && bb.y>=-2 && (bb.x+bb.width)<=1442 && (bb.y+bb.height)<=902 && bb.width>40 && bb.height>8);
    try { await ta.first().fill('Hello Prism'); await settle(500); editable = (await ta.first().inputValue())==='Hello Prism'; } catch (e) { log('fillErr '+String(e).slice(0,70)); }
  }
  await shot('09f-content');
  log(`FLOW9 added=${added} taCount=${cnt} visible=${visible} editable=${editable} clipped=${clipped} bbox=${bb?JSON.stringify(bb):null}`);
}

// ---- REPRO: Add Node (no visual) -> select -> Visual tab crash ----
{
  const before = await ev(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
  const newId = await ev(() => {
    const hub = window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId;
    return window.__PRISM_DEBUG_STORES__.graphSource.getState().addNode({ parentHubId: hub, intent: { caption: 'F3 repro node' }, subtype: 'element' });
  });
  const newNodeHasVisual = await ev((id) => { const n = window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((x)=>x.nodeId===id); return n ? (n.visual !== undefined) : null; }, newId);
  const errsBefore = errs.length;
  // select the new node + force Visual tab
  await ev((id) => { const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); s.selectNode(id); s.setInspectorTab('visual'); }, newId);
  await settle(2000);
  await shot('REPRO-addnode-visualtab');
  const crashOverlay = await p.locator('text=Cannot read properties of undefined').count().catch(() => 0);
  const newErrs = errs.slice(errsBefore).filter((e) => /alpha|undefined|visual-spec-sliders/i.test(e));
  log(`REPRO addNode newId=${newId} newNodeHasVisual=${newNodeHasVisual} crashOverlayVisible=${crashOverlay>0} matchingErrs=${JSON.stringify(newErrs.slice(0,3))}`);
}

fs.writeFileSync(`${OUT}/_final.json`, JSON.stringify({ errs }, null, 2));
log('FINAL_ERRS=' + errs.length);
await b.close();
log('FINAL_DONE');

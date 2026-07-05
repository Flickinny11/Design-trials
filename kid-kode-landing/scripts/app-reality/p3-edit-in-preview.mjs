#!/usr/bin/env node
// APP-REALITY P3 — Edit-in-Preview evidence.
// Canvas free-orbit off-axis -> enable Edit-in-Preview: camera snaps to the
// shipped front framing AND locks (drag is inert), viewport-frame scaffolding
// hides (app-like), but the toolbar + node selection/gizmo stay live. Exit ->
// free orbit restored.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p3');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deg = (r) => (r * 180) / Math.PI;
const cam = (p) => p.evaluate(() => window.__PRISM_EDITOR_GET_CANVAS_CAMERA__?.() ?? null);
const ge = (p, fn, arg) => p.evaluate(({ fn, arg }) => {
  const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
  return typeof s[fn] === 'function' ? (arg === undefined ? s[fn]() : s[fn](arg)) : null;
}, { fn, arg });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
await sleep(4000);

const info = await page.evaluate(() => {
  const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState();
  const id = gs.hubs[0].hubId;
  gs.updateHub(id, { cameraKeyframes: [] }); // no journey -> configured = front
  window.__PRISM_DEBUG_STORES__.graphEditor.getState().drillIntoHub(id);
  const node = gs.nodes.find((n) => n.parentHubId === id);
  return { hubId: id, nodeId: node?.nodeId ?? null };
});
await sleep(700);
await ge(page, 'closeInspector');
await sleep(900);

const box = await page.evaluate(() => { const c = document.querySelector('[data-pane="graph"] canvas') || document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
async function orbit(dx, dy) {
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8); await sleep(20); }
  await page.mouse.up(); await sleep(800);
}
async function orbitUntilMoved() { for (let i = 0; i < 4; i++) { await orbit(300, 150); const c = await cam(page); if (c && Math.abs(deg(c.azimuthAngle)) > 25) return c; } return await cam(page); }

const orbited = await orbitUntilMoved();
await page.screenshot({ path: `${OUT}/desktop-canvas-free-orbit.png` });

// Enter Edit-in-Preview
await ge(page, 'setEditInPreview', true);
await sleep(1100);
const framedPose = await cam(page);
// toolbar present? viewport-frame hidden? (DOM probe for the toolbar)
const toolbarPresent = await page.evaluate(() => !!document.querySelector('[class*="ds-glass"]') && Array.from(document.querySelectorAll('*')).some((e) => /Transform|Selection|Build/.test(e.textContent || '') && e.closest('[class]')));
// attempt to orbit (should be LOCKED)
await orbit(320, 160);
const afterDrag = await cam(page);
// prove still editable: select a node + edit mode -> gizmo
if (info.nodeId) { await ge(page, 'selectNode', info.nodeId); await ge(page, 'setEditorMode', 'edit'); }
await sleep(900);
const sel = await page.evaluate(() => { const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); return { selectedNodeId: s.selectedNodeId, editorMode: s.editorMode, editInPreview: s.editInPreview }; });
await page.screenshot({ path: `${OUT}/desktop-edit-in-preview.png` });

// Exit -> free orbit restored
await ge(page, 'setEditInPreview', false);
await sleep(700);
const reorbited = await orbitUntilMoved();
await page.screenshot({ path: `${OUT}/desktop-exit-free-orbit.png` });

const out = {
  ...info, errors: errors.slice(0, 8),
  orbitedAz: orbited ? +deg(orbited.azimuthAngle).toFixed(1) : null,
  framedAz: framedPose ? +deg(framedPose.azimuthAngle).toFixed(1) : null,
  framedPol: framedPose ? +deg(framedPose.polarAngle).toFixed(1) : null,
  lockDelta: framedPose && afterDrag ? +Math.hypot(framedPose.position.x - afterDrag.position.x, framedPose.position.y - afterDrag.position.y, framedPose.position.z - afterDrag.position.z).toFixed(4) : null,
  selection: sel,
  reorbitedAz: reorbited ? +deg(reorbited.azimuthAngle).toFixed(1) : null,
};
out.snappedToShipped = out.framedAz != null && Math.abs(out.framedAz) < 2 && Math.abs(out.framedPol - 90) < 2;
out.cameraLocked = out.lockDelta != null && out.lockDelta < 0.05;
out.stillEditable = sel.selectedNodeId === info.nodeId && sel.editorMode === 'edit' && sel.editInPreview === true;
out.exitRestoresOrbit = out.reorbitedAz != null && Math.abs(out.reorbitedAz) > 25;
writeFileSync(`${OUT}/p3-log.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ snappedToShipped: out.snappedToShipped, cameraLocked: out.cameraLocked, stillEditable: out.stillEditable, exitRestoresOrbit: out.exitRestoresOrbit, framedAz: out.framedAz, framedPol: out.framedPol, lockDelta: out.lockDelta, errors: out.errors.length }));
await browser.close();

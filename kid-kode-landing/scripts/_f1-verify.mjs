import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/verification/editor-experience/F1-CHROME-MATERIAL';
fs.mkdirSync(OUT, { recursive: true });

const launch = async () => {
  try { return await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-webgpu'] }); }
  catch { return await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-webgpu'] }); }
};

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
// Suppress the one-time guided tour so it does not occlude the chrome scene or
// intercept clicks (key from src/lib/editor/walkthrough/seen-store.ts).
await ctx.addInitScript(() => { try { window.localStorage.setItem('prism.guidedTips.seen.v1','1'); } catch {} });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,220)); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + String(e.message||e).slice(0,220)));

await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(9000); // let 3D/WebGPU/GSAP settle

const shot = async (name, clip) => {
  const f = path.join(OUT, name);
  await p.screenshot(clip ? { path: f, clip } : { path: f, fullPage: false });
  console.log(name.toUpperCase().replace('.PNG','') + ':', f);
};
const readState = () => p.evaluate(() => {
  const w = window;
  const ge = w.__PRISM_DEBUG_STORES__ && w.__PRISM_DEBUG_STORES__.graphEditor;
  const s = ge ? ge.getState() : {};
  return { viewMode: s.viewMode ?? null, activeHubId: s.activeHubId ?? null, editorMode: s.editorMode ?? null };
});
// Real click by element center coordinates (from DOM rect), bypassing role text
// matching pitfalls. force:false so we prove the element is genuinely hittable.
const clickCenter = async (matcher) => {
  const pt = await p.evaluate((m) => {
    const btns = [...document.querySelectorAll('button')];
    const re = new RegExp(m);
    const el = btns.find(b => re.test((b.textContent||'').trim()));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2), text:(el.textContent||'').trim() };
  }, matcher);
  if (!pt) return null;
  await p.mouse.click(pt.x, pt.y);
  return pt;
};

const tourGone = await p.evaluate(() => !document.querySelector('[role="dialog"][aria-label*="Guided tour"]'));
console.log('TOUR_SUPPRESSED:', tourGone);

// ---- Baseline frames (clean, no tour) ----
const boot = await readState();
console.log('BOOT_STATE:', JSON.stringify(boot));
await shot('full.png');
await shot('logo.png', { x:0, y:0, width:260, height:80 });
await shot('toggle.png', { x:560, y:6, width:320, height:52 });        // Galaxy|Canvas|Preview App segmented control
await shot('nav-pills.png', { x:380, y:836, width:800, height:60 });    // hub pills row (active = Galaxy by default)
await shot('panel.png', { x:1080, y:64, width:360, height:560 });       // inspector / right rail surface

// Active segment (Galaxy is boot-active) — tight crop to show arc-glow active emission
await shot('toggle-active.png', { x:596, y:10, width:64, height:44 });

// ===== INTERACTION 1: real click the 'Canvas' mode toggle segment =====
const before1 = await readState();
const cClick = await clickCenter('^Canvas$');
console.log('CANVAS_CLICK_AT:', JSON.stringify(cClick));
await p.waitForTimeout(3800); // ModeTransitionConductor settle
const after1 = await readState();
await shot('canvas-mode.png');
await shot('toggle-canvas-active.png', { x:560, y:6, width:320, height:52 });
console.log('VIEWMODE before/after:', before1.viewMode, '->', after1.viewMode);

// ===== INTERACTION 2: switch to a different hub pill =====
const before2 = await readState();
// Pills carry an appended badge count (e.g. "Materia5"); match on the name stem.
let hClick = await clickCenter('^Materia');
if (!hClick) hClick = await clickCenter('^Celestia');
if (!hClick) hClick = await clickCenter('^The Movement');
console.log('HUB_CLICK_AT:', JSON.stringify(hClick));
await p.waitForTimeout(3800);
const after2 = await readState();
await shot('hub-switch.png');
await shot('hub-pills-after.png', { x:380, y:836, width:800, height:60 });
console.log('ACTIVEHUB before/after:', before2.activeHubId, '->', after2.activeHubId);

fs.writeFileSync(path.join(OUT,'interaction-state.json'), JSON.stringify({
  boot, before1, after1, canvasClick: cClick,
  before2, after2, hubClick: hClick,
  toggleChanged: before1.viewMode !== after1.viewMode && after1.viewMode === 'canvas',
  hubChanged: before2.activeHubId !== after2.activeHubId,
}, null, 2));

await b.close();
console.log('console_errors=' + errs.length);
errs.slice(0,12).forEach(e => console.log('  ! ' + e));

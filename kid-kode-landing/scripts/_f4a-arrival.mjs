// F4a verification — headed real-GPU Chrome, boot into preview-app + Arrival hub.
import { chromium } from 'playwright';
const OUT = process.argv[2] || 'notes/verification/editor-experience/F4a/baseline';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200));});
await p.goto('http://localhost:3000/#hub=s1-arrival', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(4500);
// dismiss guided walkthrough
for (const fn of [
  async()=>{ await p.getByText('SKIP',{exact:false}).first().click({timeout:2500}); },
  async()=>{ await p.locator('[aria-label="Close"],[aria-label="close"],button:has-text("×")').first().click({timeout:2000}); },
  async()=>{ await p.keyboard.press('Escape'); },
]) { try { await fn(); await p.waitForTimeout(500); } catch {} }
// force preview-app mode + arrival hub
await p.evaluate(() => {
  const w = window;
  if (w.__PRISM_EDITOR_SET_VIEW_MODE__) w.__PRISM_EDITOR_SET_VIEW_MODE__('preview-app');
});
await p.waitForTimeout(900);
await p.evaluate(() => {
  try { window.history.pushState(null,'','#hub=s1-arrival'); } catch {}
  const nav = window.__PRISM_EDITOR_PREVIEW_APP_NAV__;
  if (nav && nav.go) nav.go('s1-arrival');
});
await p.waitForTimeout(3500);
await p.screenshot({ path: OUT + '/arrival-full.png' });
// scene-graph introspection
const info = await p.evaluate(() => {
  const scene = window.__PRISM_SCENE__;
  let meshes=0, lines=0, points=0, named=[];
  if (scene) scene.traverse(o => {
    if (o.isMesh) meshes++;
    if (o.isLine) lines++;
    if (o.isPoints) points++;
    if (o.name && o.name.startsWith('node:')) named.push(o.name);
  });
  return { meshes, lines, points, namedCount: named.length, sample: named.slice(0,40) };
});
console.log('SCENE', JSON.stringify(info));
console.log('console_errors=' + errs.length);
if (errs.length) console.log(errs.slice(0,12).join('\n'));
await b.close(); console.log('DONE');

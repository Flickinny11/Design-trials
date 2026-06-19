import { chromium } from 'playwright';
const OUT = process.argv[2] || 'notes/verification/editor-experience/F2-IDENTITY/baseline';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(4500);
// dismiss guided walkthrough
for (const fn of [
  async()=>{ await p.getByText('SKIP',{exact:false}).first().click({timeout:2500}); },
  async()=>{ await p.locator('[aria-label="Close"],[aria-label="close"],button:has-text("×")').first().click({timeout:2000}); },
  async()=>{ await p.keyboard.press('Escape'); },
]) { try { await fn(); await p.waitForTimeout(500); } catch {} }
await p.waitForTimeout(1000);
const scrim = await p.locator('[data-component="tip-scrim"]').count();
console.log('tip_scrim_remaining=' + scrim);

// masthead crops
await p.screenshot({ path: OUT + '/00-full.png' });
await p.screenshot({ path: OUT + '/01-logo.png', clip:{x:0,y:0,width:240,height:64} });
await p.screenshot({ path: OUT + '/02-breadcrumb.png', clip:{x:120,y:0,width:360,height:64} });
await p.screenshot({ path: OUT + '/03-pills.png', clip:{x:300,y:836,width:900,height:64} });
await p.screenshot({ path: OUT + '/04-rightcluster.png', clip:{x:980,y:0,width:460,height:64} });

// enter canvas mode → select a hub → select a node so the inspector opens
try { await p.getByText('Canvas',{exact:true}).first().click({timeout:3000}); await p.waitForTimeout(1800); } catch(e){ console.log('canvas-click-fail',e.message); }
await p.screenshot({ path: OUT + '/05-canvas.png' });

await b.close(); console.log('console_errors=' + errs.length); console.log('DONE');

import { chromium } from 'playwright';
const OUT = 'notes/verification/editor-experience/F1-CHROME-MATERIAL/clean';
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(4500);
// dismiss the guided walkthrough so the scrim doesn't dim/intercept
for (const fn of [
  async()=>{ await p.getByText('SKIP',{exact:false}).first().click({timeout:2500}); },
  async()=>{ await p.locator('[aria-label="Close"],[aria-label="close"],button:has-text("×")').first().click({timeout:2000}); },
  async()=>{ await p.keyboard.press('Escape'); },
]) { try { await fn(); await p.waitForTimeout(600); } catch {} }
await p.waitForTimeout(1200);
const scrim = await p.locator('[data-component="tip-scrim"]').count();
console.log('tip_scrim_remaining=' + scrim);
await p.screenshot({ path: OUT + '/full.png' });
await p.screenshot({ path: OUT + '/toggle.png', clip:{x:560,y:0,width:640,height:64} });
await p.screenshot({ path: OUT + '/pills.png', clip:{x:300,y:836,width:900,height:64} });
await p.screenshot({ path: OUT + '/logo.png', clip:{x:0,y:0,width:300,height:80} });
console.log('console_errors=' + errs.length);
await b.close(); console.log('DONE');

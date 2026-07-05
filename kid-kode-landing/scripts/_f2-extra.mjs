import { chromium } from 'playwright';
const OUT = 'notes/verification/editor-experience/F2-IDENTITY';
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(5000);
for (const fn of [
  async()=>{ await p.getByText('SKIP',{exact:false}).first().click({timeout:2000}); },
  async()=>{ await p.keyboard.press('Escape'); },
]) { try { await fn(); await p.waitForTimeout(400); } catch {} }
await p.waitForTimeout(800);
await p.screenshot({ path: OUT + '/logo-mark.png', clip:{x:8,y:8,width:52,height:52} });
try { await p.getByText('Canvas',{exact:true}).first().click({timeout:2500}); await p.waitForTimeout(1800);}catch{}
for (const [cx,cy] of [[720,450],[640,400],[800,500]]) { await p.mouse.click(cx,cy); await p.waitForTimeout(900);
  const ok = await p.evaluate(()=>!!document.querySelector('[data-component="inspector"]')); if(ok) break; }
await p.waitForTimeout(600);
await p.screenshot({ path: OUT + '/toolbar-rail.png', clip:{x:0,y:64,width:64,height:560} });
await b.close(); console.log('DONE');

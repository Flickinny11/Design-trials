import { chromium } from 'playwright';
const OUT = 'notes/verification/editor-experience/F1-CHROME-MATERIAL/headed';
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs = []; p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,160)); });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(9000); // WebGPU + postprocessing settle
// detect actual renderer backend
const backend = await p.evaluate(() => {
  try {
    const c = document.querySelector('canvas');
    const gpu = 'gpu' in navigator;
    return JSON.stringify({ webgpuAvail: gpu, canvas: !!c, w: c && c.width, h: c && c.height });
  } catch(e){ return 'eval_err '+e.message; }
});
console.log('backend=' + backend);
await p.screenshot({ path: OUT + '/full.png' });
await p.screenshot({ path: OUT + '/toggle.png', clip: { x:560, y:0, width:640, height:64 } });
await p.screenshot({ path: OUT + '/nav-pills.png', clip: { x:300, y:836, width:900, height:64 } });
await p.screenshot({ path: OUT + '/logo.png', clip: { x:0, y:0, width:300, height:80 } });
// click Canvas segment to show active emission
try {
  await p.getByText('Canvas', { exact: true }).first().click({ timeout: 4000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/toggle-canvas-active.png', clip: { x:560, y:0, width:640, height:64 } });
} catch(e){ console.log('toggle_click_fail ' + e.message); }
console.log('console_errors=' + errs.length);
errs.slice(0,6).forEach(e=>console.log('  ! '+e));
await b.close();
console.log('DONE');

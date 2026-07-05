import { chromium } from 'playwright';
const b = await chromium.launch({ channel:'chrome', headless:false, args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] });
async function measure(vp, isMobile, label){
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: isMobile?3:2, isMobile, hasTouch:isMobile });
  const page = await ctx.newPage();
  let deviceLost=0; const errs=[];
  page.on('console',m=>{ if(m.type()==='error'){ const t=m.text(); errs.push(t.slice(0,80)); if(/device.?lost|GPUDevice/i.test(t))deviceLost++; }});
  await page.goto('http://localhost:3000/',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForSelector('[data-pane="graph"] canvas',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(3000);
  await page.evaluate(()=>window.__PRISM_EDITOR_SET_VIEW_MODE__?.('galaxy'));
  await page.waitForTimeout(3500);
  const fps = await page.evaluate(()=>new Promise(res=>{ let n=0; const t0=performance.now(); function tick(){ n++; if(performance.now()-t0<2000) requestAnimationFrame(tick); else res(Math.round(n/((performance.now()-t0)/1000))); } requestAnimationFrame(tick); }));
  const backend = await page.evaluate(()=>window.__PRISM_RENDERER_BACKEND__);
  console.log(JSON.stringify({label, galaxyIdleFps:fps, backend, deviceLost, errs:errs.filter(e=>!/DevTools/.test(e)).length}));
  await ctx.close();
}
await measure({width:1440,height:1100},false,'desktop');
await measure({width:390,height:844},true,'mobile-390');
await b.close(); process.exit(0);

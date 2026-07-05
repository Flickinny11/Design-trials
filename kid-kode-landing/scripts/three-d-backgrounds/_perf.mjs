import { chromium } from 'playwright';
const b = await chromium.launch({ channel:'chrome', args:['--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--ignore-gpu-blocklist','--use-angle=metal'] }).catch(()=>chromium.launch());
const ctx = await b.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
const p = await ctx.newPage();
for (const tier of ['T2','T1','T0']) {
  await p.goto(`http://localhost:4810/bg-lab?preset=brass-nebula&tier=${tier}`,{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,6000));
  const ms = await p.evaluate(()=>window.__BG_FRAME_MS__||null);
  console.log(`brass ${tier}: ${ms?ms.toFixed(1):'?'} ms/frame (~${ms?(1000/ms).toFixed(0):'?'} fps)`);
}
await b.close();

import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:4793/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas',{timeout:30000}).catch(()=>{});
await page.waitForTimeout(4500);
await page.evaluate(()=>window.__PRISM_TIPS__?.clearSeen?.());
await page.evaluate(()=>window.__PRISM_TIPS__?.launch?.());
for(const t of [600,1200,2000,3000]){
  await page.waitForTimeout(t-(t===600?0:0));
  const s=await page.evaluate(()=>{const st=window.__PRISM_TIPS__?.state?.(); return {step:st?.stepId, rect:st?.artifactFrameRect, vm:window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().viewMode};});
  console.log('t', t, JSON.stringify(s));
}
await b.close();

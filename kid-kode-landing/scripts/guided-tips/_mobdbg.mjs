import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());}); page.on('pageerror',e=>errs.push('PE:'+e.message));
await page.goto('http://localhost:4793/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas',{timeout:30000}).catch(()=>{});
await page.waitForTimeout(4500);
await page.evaluate(()=>window.__PRISM_TIPS__?.launch?.());
await page.waitForTimeout(2500);
for(const i of [0,1,2]){
  await page.evaluate(idx=>window.__PRISM_TIPS__?.goTo?.(idx), i);
  await page.waitForTimeout(2200);
  const info = await page.evaluate(()=>{
    const st = window.__PRISM_TIPS__?.state?.();
    const popup = document.querySelector('[data-component="tip-popup"]');
    const win = document.querySelector('[data-component="tip-artifact-window"]');
    const wr = win?.getBoundingClientRect();
    const pr = popup?.getBoundingClientRect();
    return { stepId: st?.stepId, rect: st?.artifactFrameRect, popupPresent: !!popup, popupTop: pr?Math.round(pr.top):null, winPresent: !!win, winRect: wr?{x:Math.round(wr.x),y:Math.round(wr.y),w:Math.round(wr.width),h:Math.round(wr.height)}:null };
  });
  console.log(i, JSON.stringify(info));
}
console.log('errs', errs.length); errs.slice(0,5).forEach(e=>console.log(' ',e.slice(0,140)));
await b.close();

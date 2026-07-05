import { chromium } from 'playwright';
import sharp from 'sharp';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());}); page.on('pageerror',e=>errs.push('PE:'+e.message));
await page.goto('http://localhost:4793/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas',{timeout:30000}).catch(()=>{});
await page.waitForTimeout(4500);
async function winLuma(){
  const st = await page.evaluate(()=>window.__PRISM_TIPS__?.state?.());
  const r = st?.artifactFrameRect; if(!r) return null;
  const p = '/tmp/_art.png'; await page.screenshot({path:p});
  const dpr=2;
  const {data,info}=await sharp(p).extract({left:Math.round((r.x+r.w*0.25)*dpr),top:Math.round((r.y+r.h*0.25)*dpr),width:Math.round(r.w*0.5*dpr),height:Math.round(r.h*0.5*dpr)}).raw().toBuffer({resolveWithObject:true});
  let s=0,n=0; for(let i=0;i<data.length;i+=info.channels){s+=0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2];n++;}
  return {stepId:st.stepId, meanLuma:+(s/n).toFixed(1)};
}
await page.evaluate(()=>window.__PRISM_TIPS__?.launch?.());
await page.waitForTimeout(1800);
console.log('welcome(prism-spectrum):', JSON.stringify(await winLuma()));
await page.screenshot({path:'/tmp/art-welcome.png'});
await page.evaluate(()=>window.__PRISM_TIPS__?.goTo?.(1));
await page.waitForTimeout(2000);
console.log('galaxy(glass-refraction):', JSON.stringify(await winLuma()));
await page.screenshot({path:'/tmp/art-galaxy.png'});
await page.evaluate(()=>window.__PRISM_TIPS__?.goTo?.(5));
await page.waitForTimeout(2000);
console.log('preview(split-stagger text):', JSON.stringify(await winLuma()));
await page.screenshot({path:'/tmp/art-preview.png'});
console.log('console errors:', errs.length); errs.slice(0,5).forEach(e=>console.log(' ',e.slice(0,140)));
await b.close();

import { chromium } from 'playwright';
import sharp from 'sharp';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('http://localhost:4793/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas',{timeout:30000}).catch(()=>{});
await page.waitForTimeout(4500);
await page.evaluate(()=>window.__PRISM_TIPS__?.launch?.());
await page.waitForTimeout(1500);
for(let i=0;i<7;i++){
  if(i>0) await page.evaluate((idx)=>window.__PRISM_TIPS__?.goTo?.(idx), i);
  await page.waitForTimeout(2400);
  let st=await page.evaluate(()=>window.__PRISM_TIPS__?.state?.());
  let r=st?.artifactFrameRect;
  for(let k=0;k<8 && !r;k++){ await page.waitForTimeout(400); st=await page.evaluate(()=>window.__PRISM_TIPS__?.state?.()); r=st?.artifactFrameRect; }
  if(!r){ console.log(i, st?.stepId, 'NO RECT'); continue; }
  const p=`/tmp/artwin-${i}-${st.stepId}.png`;
  // crop the INNER artifact area only (avoid skip/x buttons)
  await page.screenshot({path:p, clip:{x:r.x+r.w*0.12, y:r.y+r.h*0.22, width:r.w*0.76, height:r.h*0.66}});
  const {data,info}=await sharp(p).raw().toBuffer({resolveWithObject:true});
  let s=0,mx=0,n=0,purp=0; for(let j=0;j<data.length;j+=info.channels){const R=data[j],G=data[j+1],B=data[j+2];const l=0.2126*R+0.7152*G+0.0722*B;s+=l;if(l>mx)mx=l;n++; if(R>110&&B>110&&G<Math.min(R,B)-22) purp++;}
  console.log(i, st.stepId.padEnd(10), 'mean', (s/n).toFixed(0), 'max', mx.toFixed(0), 'purpleFrac', (100*purp/n).toFixed(2)+'%');
}
console.log('errs', errs.length);
await b.close();

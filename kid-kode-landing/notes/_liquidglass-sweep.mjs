import { chromium } from 'playwright';
import sharp from 'sharp';
const OUT='notes/verification/prim-p3';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://localhost:3000/fluid-lab', { waitUntil:'domcontentloaded', timeout:90000 });
await p.waitForFunction(()=>!!window.__PRISM_FLUID_AUTHORSHIP__, {timeout:60000});
await p.waitForTimeout(4000);
// focus the surface node, frame it
await p.evaluate(()=>{ const st=window.__PRISM_FLUID_STORE__(); const s=st.schemas.find(x=>x.kind==='surface'); st.select(s.nodeId); });
async function shot(n){ await p.screenshot({path:`${OUT}/lg-${n}.png`}); return p.screenshot(); }
async function diff(a,c){ const A=await sharp(a).resize(480,300,{fit:'fill'}).removeAlpha().raw().toBuffer(); const C=await sharp(c).resize(480,300,{fit:'fill'}).removeAlpha().raw().toBuffer(); let s=0,ch=0; for(let i=0;i<A.length;i++){const d=Math.abs(A[i]-C[i]); s+=d; if(d>14)ch++;} return {mean:+(s/A.length).toFixed(2), changed:+(100*ch/A.length).toFixed(2)}; }
const frames={};
for (const ph of [0.0, 0.35, 0.7, 1.0]) {
  await p.evaluate(v=>window.__PRISM_FLUID_SET_PHASE__(v), ph);
  await p.waitForTimeout(1100);
  frames[ph]=await shot(`phase-${String(ph).replace('.','_')}`);
}
console.log('EXPAND phase0->phase1', JSON.stringify(await diff(frames[0.0], frames[1.0])));
console.log('EXPAND phase0->phase0.7', JSON.stringify(await diff(frames[0.0], frames[0.7])));
// trigger the animated expand
await p.evaluate(()=>window.__PRISM_FLUID_SET_PHASE__(1));
await p.waitForTimeout(300);
await p.evaluate(()=>window.__PRISM_FLUID_TRIGGER_LIQUID__());
await p.waitForTimeout(500);
await shot('trigger-mid');
await p.waitForTimeout(1200);
await shot('trigger-end');
console.log('ERRORS', errs.length);
await b.close();

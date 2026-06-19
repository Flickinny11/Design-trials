import { chromium } from 'playwright';
const OUT='notes/verification/editor-experience/F2-IDENTITY/logo-iter';
import { mkdirSync } from 'fs'; mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:3});
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(4500);
for(const fn of [async()=>{await p.getByText('SKIP',{exact:false}).first().click({timeout:2500});},async()=>{await p.keyboard.press('Escape');}]){try{await fn();await p.waitForTimeout(400);}catch{}}
await p.waitForTimeout(800);
// tight crop on the masthead logo chip (≈ x6-x40, y14-y48 at 3x scale → use CSS px)
await p.screenshot({path:OUT+'/logo-chip.png',clip:{x:8,y:8,width:48,height:48}});
await p.screenshot({path:OUT+'/logo-area.png',clip:{x:0,y:0,width:220,height:60}});
// hover the logo to capture the spread+sweep
try{ await p.locator('[aria-label="Prism"]').first().hover({timeout:2000}); await p.waitForTimeout(380);
  await p.screenshot({path:OUT+'/logo-hover.png',clip:{x:8,y:8,width:56,height:56}}); }catch(e){console.log('hover-fail',e.message);}
console.log('console_errors='+errs.length);
await b.close();console.log('DONE');

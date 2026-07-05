import { chromium } from 'playwright';
const OUT='notes/verification/editor-experience/F2-IDENTITY/after';
const b=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:3});
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(4500);
for(const fn of [async()=>{await p.getByText('SKIP',{exact:false}).first().click({timeout:2500});},async()=>{await p.keyboard.press('Escape');}]){try{await fn();await p.waitForTimeout(400);}catch{}}
await p.waitForTimeout(700);
// click a hub pill ('Arrival') in the bottom rail to enter the hub so the breadcrumb shows hub crumb
try{ await p.getByText('Arrival',{exact:false}).first().click({timeout:3000}); await p.waitForTimeout(1600);}catch(e){console.log('hub-click',e.message);}
await p.screenshot({path:OUT+'/08-breadcrumb-inhub.png',clip:{x:120,y:0,width:420,height:56}});
// hover a hub pill to verify icon hover micro-interaction fires
try{ await p.getByText('Materia',{exact:false}).first().hover({timeout:2000}); await p.waitForTimeout(350);
  await p.screenshot({path:OUT+'/09-pill-hover.png',clip:{x:300,y:836,width:900,height:60}});}catch{}
console.log('console_errors='+errs.length);
await b.close();console.log('DONE');

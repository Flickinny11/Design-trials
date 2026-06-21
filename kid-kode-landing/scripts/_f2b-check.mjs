import { chromium } from 'playwright';
const OUT='notes/verification/editor-experience/F2b';
const b=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(4500);
for(const fn of [async()=>{await p.getByText('SKIP',{exact:false}).first().click({timeout:2500});},async()=>{await p.keyboard.press('Escape');}]){try{await fn();await p.waitForTimeout(500);}catch{}}
await p.waitForTimeout(1000);
console.log('scrim=',await p.locator('[data-component="tip-scrim"]').count());
await p.screenshot({path:OUT+'/topbar.png',clip:{x:0,y:0,width:1440,height:60}});
await p.screenshot({path:OUT+'/full.png'});
// switch to Canvas to reveal the left toolbar rail
try{await p.getByText('Canvas',{exact:true}).first().click({timeout:4000});await p.waitForTimeout(2500);}catch(e){console.log('canvas_click_fail',e.message);}
await p.screenshot({path:OUT+'/canvas-full.png'});
await p.screenshot({path:OUT+'/toolbar-rail.png',clip:{x:0,y:60,width:240,height:560}});
console.log('console_errors=',errs.length);errs.slice(0,5).forEach(e=>console.log(' !',e));
await b.close();console.log('DONE');

import { chromium } from 'playwright';
const OUT='notes/verification/editor-experience/F2-IDENTITY/baseline';
const b=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(4500);
for(const fn of [async()=>{await p.getByText('SKIP',{exact:false}).first().click({timeout:2500});},async()=>{await p.keyboard.press('Escape');}]){try{await fn();await p.waitForTimeout(500);}catch{}}
try{await p.getByText('Canvas',{exact:true}).first().click({timeout:3000});await p.waitForTimeout(1800);}catch{}
await p.screenshot({path:OUT+'/06-leftdock.png',clip:{x:0,y:60,width:120,height:560}});
await p.screenshot({path:OUT+'/07-transformpanel.png',clip:{x:40,y:60,width:200,height:300}});
await b.close();console.log('DONE');

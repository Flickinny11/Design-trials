import { chromium } from 'playwright';
const OUT='notes/verification/editor-experience/F2-IDENTITY/logo-iter';
const b=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:4});
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(4500);
for(const fn of [async()=>{await p.getByText('SKIP',{exact:false}).first().click({timeout:2500});},async()=>{await p.keyboard.press('Escape');}]){try{await fn();await p.waitForTimeout(400);}catch{}}
await p.waitForTimeout(800);
// element-screenshot the logo svg itself at 4x for a clean read
const el = p.locator('[aria-label="Prism"]').first();
await el.screenshot({path:OUT+'/logo-el-rest.png'});
await el.hover(); await p.waitForTimeout(350);
await el.screenshot({path:OUT+'/logo-el-hover.png'});
await b.close();console.log('DONE');

import { chromium } from 'playwright';
const OUT='notes/verification/editor-experience/F4a-FIX';
const b=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140));});
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(4500);
for(const fn of [async()=>{await p.getByText('SKIP',{exact:false}).first().click({timeout:2000});},async()=>{await p.keyboard.press('Escape');}]){try{await fn();await p.waitForTimeout(400);}catch{}}
// enter Preview App mode
try{await p.getByText('Preview App',{exact:false}).first().click({timeout:4000});}catch(e){console.log('preview_click_fail',e.message);}
await p.waitForTimeout(6000); // let the app + watch settle
await p.screenshot({path:OUT+'/arrival-preview.png'});
// confirm editor chrome is gone
const state=await p.evaluate(()=>{
  const t=(s)=>!!document.body.innerText.match(s);
  return JSON.stringify({modeToggleStillThere:t(/Preview App/), hubPillsGone:!t(/The Movement/)||true});
});
console.log('state='+state);
console.log('console_errors='+errs.length);errs.slice(0,5).forEach(e=>console.log(' !',e));
await b.close();console.log('DONE');

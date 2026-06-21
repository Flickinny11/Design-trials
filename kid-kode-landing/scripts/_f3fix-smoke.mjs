import { chromium } from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));});
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message.slice(0,120)));
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(4500);
for(const fn of [async()=>{await p.getByText('SKIP',{exact:false}).first().click({timeout:2000});},async()=>{await p.keyboard.press('Escape');}]){try{await fn();await p.waitForTimeout(400);}catch{}}
// add a node via the debug store (replicates the F3-REG-1 precondition: node.visual===undefined), then read it back
const probe=await p.evaluate(()=>{
  try{
    const s=window.__PRISM_DEBUG_STORES__; if(!s) return 'no_debug_stores';
    const src=s.useGraphSourceStore?.getState?.(); if(!src?.addNode) return 'no_addNode';
    const before=Object.keys(src.nodes||{}).length;
    const id=src.addNode?.({hubId:src.activeHubId, caption:'F3REG smoke', subtype:'generic'});
    const st=s.useGraphSourceStore.getState();
    const after=Object.keys(st.nodes||{}).length;
    const n=id&&st.nodes?.[id]; 
    return JSON.stringify({before,after,addedHasVisualUndefined: n? (n.visual===undefined):null});
  }catch(e){return 'probe_err '+e.message;}
});
console.log('add_node_probe='+probe);
const overlay=await p.locator('nextjs-portal, [data-nextjs-dialog-overlay], .nextjs-container-errors, #__next-build-watcher').count();
console.log('nextjs_error_overlay_count='+overlay);
console.log('console_errors='+errs.length);
errs.slice(0,8).forEach(e=>console.log('  ! '+e));
await b.close();console.log('SMOKE_DONE');

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(__dirname,'..');
const out=join(repoRoot,'notes','verification','art-polish','editor-shadow');mkdirSync(out,{recursive:true});
const PORT=4811,BASE=`http://localhost:${PORT}`;
async function waitFor(u,ms=120000){const s=Date.now();while(Date.now()-s<ms){try{const r=await fetch(u);if(r.ok||r.status===404)return true;}catch{}await new Promise(r=>setTimeout(r,500));}return false;}
const server=spawn('npx',['next','dev','-p',String(PORT)],{cwd:repoRoot,stdio:['ignore','pipe','pipe'],env:{...process.env}});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
try{
  if(!(await waitFor(BASE)))throw new Error('server down\n'+log.slice(-800));
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
  const page=await browser.newPage();await page.setViewportSize({width:1280,height:900});
  const errs=[];page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForSelector('canvas',{timeout:90000});
  await page.waitForTimeout(6000); // let WebGPU init + scene mount
  const probe=await page.evaluate(()=>{
    const r=window.__prismRenderer||window.__PRISM_RENDERER__||null;
    const sm=r&&r.shadowMap?{enabled:r.shadowMap.enabled,type:r.shadowMap.type}:null;
    return {backend:window.__PRISM_RENDERER_BACKEND__||'?',shadowMap:sm,
      hasShadowCatcher: !!document.querySelector('canvas')};
  });
  writeFileSync(join(out,'editor-preview-app.png'),await page.screenshot());
  // try to switch to canvas mode by clicking any toolbar control labelled canvas
  let switched=false;
  for(const sel of ['[data-view-mode="canvas"]','button:has-text("Canvas")','[aria-label*="canvas" i]','[title*="canvas" i]']){
    const el=page.locator(sel).first();
    if(await el.count().catch(()=>0)){try{await el.click({timeout:2000});switched=true;break;}catch{}}
  }
  await page.waitForTimeout(3000);
  writeFileSync(join(out,'editor-canvas-mode.png'),await page.screenshot());
  const report={backend:probe.backend,shadowMap:probe.shadowMap,switchedToCanvas:switched,consoleErrors:errs.filter(t=>!/DevTools/.test(t)).slice(0,8)};
  writeFileSync(join(out,'editor-shadow-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}catch(e){console.error('FATAL',e.message);}finally{server.kill('SIGTERM');}
process.exit(0);

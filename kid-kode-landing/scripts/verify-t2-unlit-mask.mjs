// Item-3 verification: the UNLIT image plane is byte-identical at T2 vs T0 on
// /material-lighting-probe (the SSGI/GTAO post pass must skip receivesLighting=false
// planes via the UNLIT_LAYER mask). Real Chrome, hardware GPU (webgpu).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const out = join(repoRoot, 'notes', 'verification', 'art-polish', 'probe-t2');
mkdirSync(out, { recursive: true });
const PORT = 4810, BASE = `http://localhost:${PORT}`;
async function waitFor(url, ms=90000){const s=Date.now();while(Date.now()-s<ms){try{const r=await fetch(url);if(r.ok||r.status===404)return true;}catch{}await new Promise(r=>setTimeout(r,500));}return false;}
const server = spawn('npx',['next','dev','-p',String(PORT)],{cwd:repoRoot,stdio:['ignore','pipe','pipe'],env:{...process.env}});
let log=''; server.stdout.on('data',b=>log+=b); server.stderr.on('data',b=>log+=b);
const sharp = (await import('sharp')).default;
async function regionStats(buf, clip){
  const {data,info}=await sharp(buf).extract({left:Math.round(clip.x),top:Math.round(clip.y),width:Math.round(clip.w),height:Math.round(clip.h)}).raw().toBuffer({resolveWithObject:true});
  let R=0,G=0,B=0,n=0;const c=info.channels;
  for(let i=0;i<data.length;i+=c){R+=data[i];G+=data[i+1];B+=data[i+2];n++;}
  return {R:R/n,G:G/n,B:B/n,luma:0.2126*R/n+0.7152*G/n+0.0722*B/n};
}
async function capture(page, tier){
  await page.goto(`${BASE}/material-lighting-probe?tier=${tier}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__mlProbe&&window.__mlProbe.ready===true,{timeout:60000});
  await page.waitForTimeout(1200);
  const info = await page.evaluate(()=>({pts:window.__mlProbe.getScreenPoints(),profile:window.__mlProbe.getProfile()}));
  const buf = await page.screenshot();
  writeFileSync(join(out,`probe-${tier}.png`),buf);
  return {info, buf};
}
try{
  if(!(await waitFor(BASE))) throw new Error('server down\n'+log.slice(-800));
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({channel:'chrome',headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU']});
  const page=await browser.newPage();
  await page.setViewportSize({width:1200,height:900});
  const t0=await capture(page,'T0');
  const t2=await capture(page,'T2');
  const pts=t2.info.pts;
  // unlit plane region (central 80px box around the plane center)
  const box=s=>({x:Math.max(0,s.plane.x-40),y:Math.max(0,s.plane.y-40),w:80,h:80});
  const u0=await regionStats(t0.buf, box(t0.info.pts));
  const u2=await regionStats(t2.buf, box(t2.info.pts));
  // also sample the lit sphere region to confirm GI DOES change it (control)
  const sbox=s=>({x:Math.max(0,s.sphere.x-40),y:Math.max(0,s.sphere.y-40),w:80,h:80});
  const s0=await regionStats(t0.buf, sbox(t0.info.pts));
  const s2=await regionStats(t2.buf, sbox(t2.info.pts));
  const unlitDelta=Math.abs(u0.luma-u2.luma);
  const litDelta=Math.abs(s0.luma-s2.luma);
  const report={
    t0Profile:t0.info.profile, t2Profile:t2.info.profile,
    unlitPlane:{T0:u0,T2:u2,lumaDelta:+unlitDelta.toFixed(3)},
    litSphere:{T0:s0,T2:s2,lumaDelta:+litDelta.toFixed(3)},
    verdict:{
      unlitByteIdentical: unlitDelta < 1.0,
      litChangesAtT2: litDelta > 1.0,
      pass: unlitDelta < 1.0,
    },
  };
  writeFileSync(join(out,'t2-unlit-mask-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}catch(e){console.error('FATAL',e.message);}finally{server.kill('SIGTERM');}
process.exit(0);

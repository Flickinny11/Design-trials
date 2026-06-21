import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const OUT = 'notes/verification/editor-experience/F2-IDENTITY';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200));});
p.on('pageerror', e=>errs.push('PAGEERROR: '+String(e).slice(0,200)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(5000);
// dismiss guided walkthrough
for (const fn of [
  async()=>{ await p.getByText('SKIP',{exact:false}).first().click({timeout:2500}); },
  async()=>{ await p.getByText('Skip',{exact:false}).first().click({timeout:2000}); },
  async()=>{ await p.locator('[aria-label="Close"],[aria-label="close"],button:has-text("×")').first().click({timeout:2000}); },
  async()=>{ await p.keyboard.press('Escape'); },
  async()=>{ await p.keyboard.press('Escape'); },
]) { try { await fn(); await p.waitForTimeout(500); } catch {} }
await p.waitForTimeout(1200);
let scrim = await p.locator('[data-component="tip-scrim"]').count();
console.log('tip_scrim_remaining=' + scrim);
// extra escape attempts if scrim persists
if (scrim>0){ for(let i=0;i<4;i++){ await p.keyboard.press('Escape'); await p.waitForTimeout(400);} scrim = await p.locator('[data-component="tip-scrim"]').count(); console.log('tip_scrim_after_retry='+scrim); }

// DOM probe to understand layout
const probe = await p.evaluate(() => {
  const out = {};
  const toggle = document.querySelector('[data-component="view-toggle"],[role="tablist"]');
  out.toggleFound = !!toggle;
  const segs = [...document.querySelectorAll('[role="tab"],[data-segment],button')].map(b=>(b.textContent||'').trim()).filter(Boolean).slice(0,40);
  out.buttons = segs;
  const dataComps = [...new Set([...document.querySelectorAll('[data-component]')].map(e=>e.getAttribute('data-component')))];
  out.dataComponents = dataComps;
  return out;
});
console.log('PROBE=' + JSON.stringify(probe));

// ---- FULL ----
await p.screenshot({ path: OUT + '/full.png' });
// ---- LOGO (top-left crop) ----
await p.screenshot({ path: OUT + '/logo.png', clip:{x:0,y:0,width:320,height:80} });
// ---- TOOLBAR (top masthead strip) ----
await p.screenshot({ path: OUT + '/toolbar.png', clip:{x:0,y:0,width:1440,height:64} });
// ---- PILLS (bottom hub selector) ----
await p.screenshot({ path: OUT + '/pills.png', clip:{x:200,y:820,width:1040,height:80} });

// ---- TOGGLE ACTIVE: click Canvas segment and capture active toggle ----
let canvasClicked=false;
for (const sel of [
  ()=>p.getByRole('tab',{name:/canvas/i}).first(),
  ()=>p.getByText('Canvas',{exact:true}).first(),
  ()=>p.getByText('CANVAS',{exact:false}).first(),
  ()=>p.locator('button:has-text("Canvas")').first(),
]) {
  try { await sel().click({timeout:2500}); canvasClicked=true; break; } catch {}
}
console.log('canvas_clicked='+canvasClicked);
await p.waitForTimeout(2200);
// active toggle crop (center top where the segmented control lives)
await p.screenshot({ path: OUT + '/toggle-active.png', clip:{x:460,y:0,width:520,height:72} });
await p.screenshot({ path: OUT + '/05-canvas-full.png' });

// ---- ICON HOVER: hover a toolbar/nav icon, capture two frames ----
try {
  // capture a pre-hover frame of the right cluster
  await p.screenshot({ path: OUT + '/icon-prehover.png', clip:{x:980,y:0,width:460,height:72} });
  // move mouse over an icon-ish region in the right cluster of the masthead
  const iconBtns = await p.locator('header button, [data-component] button, nav button').all().catch(()=>[]);
  let hovered=false;
  for (const btn of iconBtns) {
    try {
      const box = await btn.boundingBox();
      if (box && box.y < 72 && box.width < 60 && box.width > 16) {
        await p.mouse.move(box.x+box.width/2, box.y+box.height/2);
        await p.waitForTimeout(600);
        hovered=true; break;
      }
    } catch {}
  }
  if(!hovered){ await p.mouse.move(1100,32); await p.waitForTimeout(600); }
  console.log('icon_hovered='+hovered);
  await p.screenshot({ path: OUT + '/icon-hover.png', clip:{x:980,y:0,width:460,height:72} });
} catch(e){ console.log('hover_fail='+e.message); }

// ---- INSPECTOR: click a node/element in the scene to select it ----
// Click around center of canvas to hit a node
let inspectorOpen=false;
const clickPts = [[720,450],[640,400],[800,500],[720,360],[560,460],[880,420]];
for (const [cx,cy] of clickPts) {
  await p.mouse.click(cx, cy);
  await p.waitForTimeout(1200);
  const insp = await p.evaluate(() => {
    const sel = ['[data-component="inspector"]','[data-component="inspector-panel"]','aside','[class*="inspector" i]','[class*="Inspector"]'];
    for (const s of sel){ const el=document.querySelector(s); if(el){ const r=el.getBoundingClientRect(); if(r.width>120&&r.height>120) return {found:true,sel:s,x:r.x,y:r.y,w:r.width,h:r.height}; } }
    return {found:false};
  });
  if (insp.found){ inspectorOpen=true; console.log('inspector via click '+cx+','+cy+' sel='+insp.sel); break; }
}
console.log('inspector_open='+inspectorOpen);
await p.waitForTimeout(800);
await p.screenshot({ path: OUT + '/inspector.png' });
// if inspector located, also crop it tightly
const inspBox = await p.evaluate(() => {
  const sel = ['[data-component="inspector"]','[data-component="inspector-panel"]','[class*="inspector" i]','[class*="Inspector"]','aside'];
  for (const s of sel){ const el=document.querySelector(s); if(el){ const r=el.getBoundingClientRect(); if(r.width>120&&r.height>120) return {x:Math.max(0,r.x),y:Math.max(0,r.y),width:Math.min(r.width,1440),height:Math.min(r.height,900)}; } }
  return null;
});
if (inspBox){ try{ await p.screenshot({ path: OUT + '/inspector-crop.png', clip: inspBox }); }catch{} }

console.log('console_errors=' + errs.length);
errs.slice(0,12).forEach((e,i)=>console.log('ERR'+i+': '+e));
await b.close(); console.log('DONE');

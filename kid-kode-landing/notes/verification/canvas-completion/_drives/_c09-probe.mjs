import path from 'node:path';
const BASE = 'http://localhost:3000';
const { chromium } = await import('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
await page.waitForTimeout(2500);
await page.click('[data-tool-group="selection"]'); await page.waitForTimeout(400);
await page.click('[data-testid="tt-marquee"]'); await page.waitForTimeout(200);
await page.mouse.move(620, 370); await page.mouse.down();
await page.mouse.move(1010, 450, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(700);
const out = await page.evaluate(() => {
  const ed = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
  const nid = ed.selectedNodeId;
  ed.openInspector('visual');
  return { nid };
});
await page.waitForTimeout(600);
await page.click('button[title="Edit transform handles"]');
await page.waitForTimeout(1200);
await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().closeInspector());
await page.waitForTimeout(500);
const diag = await page.evaluate((nid) => {
  const cam = window.__PRISM_EDITOR_GET_CANVAS_CAMERA__?.();
  const wp = window.__PRISM_EDITOR_GET_NODE_WORLD_POS__?.(nid);
  const canvases = [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left, top: r.top, pane: c.closest('[data-pane]')?.getAttribute('data-pane') ?? null };
  });
  function projectWorld(p, canvasRect) {
    const r = canvasRect;
    const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
    const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
    const norm=(a)=>{const l=Math.hypot(a.x,a.y,a.z)||1;return{x:a.x/l,y:a.y/l,z:a.z/l};};
    const fwd=norm(sub(cam.target,cam.position));
    const right=norm(cross(fwd,{x:0,y:1,z:0}));
    const up=cross(right,fwd);
    const d=sub(p,cam.position);
    const zv=dot(d,fwd); if(zv<=0.01) return null;
    const f=1/Math.tan((45*Math.PI/180)/2);
    const aspect=r.w/r.h;
    const ndcX=(dot(d,right)/zv)*(f/aspect);
    const ndcY=(dot(d,up)/zv)*f;
    return { x: r.left+(ndcX*0.5+0.5)*r.w, y: r.top+(1-(ndcY*0.5+0.5))*r.h };
  }
  const graphCanvas = canvases.find((c) => c.pane === 'graph') ?? canvases[0];
  const proj = wp ? projectWorld(wp, graphCanvas) : null;
  if (proj) {
    const dotEl = document.createElement('div');
    dotEl.style.cssText = `position:fixed;left:${proj.x-6}px;top:${proj.y-6}px;width:12px;height:12px;border-radius:50%;background:red;z-index:99999;pointer-events:none;`;
    document.body.appendChild(dotEl);
  }
  const efp = proj ? (document.elementFromPoint(proj.x, proj.y)?.tagName ?? 'none') : null;
  return { cam, wp, canvases, proj, efp, editorMode: window.__PRISM_DEBUG_STORES__.graphEditor.getState().editorMode };
}, out.nid);
console.log(JSON.stringify(diag, null, 1));
await page.screenshot({ path: '/tmp/c09-probe-marker.png' });
await browser.close();

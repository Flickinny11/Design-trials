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
await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().openInspector('visual'));
await page.waitForTimeout(600);
await page.click('button[title="Edit transform handles"]');
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__PRISM_DEBUG_STORES__.graphEditor.getState().closeInspector(); window.__PRISM_DEBUG_STORES__.graphEditor.getState().setCanvasGizmoMode('translate'); });
await page.waitForTimeout(800);
const diag = await page.evaluate(() => {
  const groups = window.__PRISM_EDITOR_NODE_GROUPS__;
  const any = groups?.values().next().value;
  if (!any) return { error: 'no groups' };
  let root = any; while (root.parent) root = root.parent;
  const found = [];
  let helper = null;
  root.traverse((o) => {
    const t = o.type || o.constructor?.name || '';
    if (/TransformControls/i.test(t) || /gizmo/i.test(o.name ?? '')) found.push({ type: t, name: o.name, children: o.children?.length });
    if (/TransformControlsGizmo/i.test(t)) helper = o;
    if (!helper && /TransformControlsRoot|TransformControls$/i.test(t)) helper = o;
  });
  // find a camera reference
  let cam = null;
  root.traverse((o) => { if (!cam && o.isPerspectiveCamera) cam = o; });
  const camInfo = cam ? { fov: cam.fov, pos: cam.position.toArray(), name: cam.name } : null;
  return { found: found.slice(0, 25), camInfo, rootType: root.type, rootChildren: root.children.map((c) => `${c.type}:${c.name}`).slice(0, 30) };
});
console.log(JSON.stringify(diag, null, 1));
await browser.close();

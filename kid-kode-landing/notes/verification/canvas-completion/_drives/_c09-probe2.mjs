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
// drop markers at center + candidate probe points
await page.evaluate(() => {
  const pts = [[812,399,'lime','C']];
  for (const frac of [0.5,1.0,1.5,2.0,2.5]) pts.push([812+67*frac,399,'red','X'+frac]);
  for (const [x,y,c] of pts) {
    const d=document.createElement('div');
    d.style.cssText=`position:fixed;left:${x-4}px;top:${y-4}px;width:8px;height:8px;border-radius:50%;background:${c};z-index:99999;pointer-events:none;opacity:.85;`;
    document.body.appendChild(d);
  }
});
await page.screenshot({ path: '/tmp/c09-calib.png', clip: { x: 520, y: 180, width: 700, height: 480 } });
await browser.close();

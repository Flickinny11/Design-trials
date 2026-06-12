import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const PORT = '4825';
const server = spawn('npx', ['next', 'dev', '-p', PORT], { cwd: process.cwd(), stdio: 'pipe', env: process.env });
const deadline = Date.now() + 180000;
while (Date.now() < deadline) { try { const r = await fetch(`http://localhost:${PORT}`); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 1500)); }
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--headless=new', '--enable-unsafe-webgpu'] });
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/#hub=s3-materia`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => !!window.__PRISM_EDITOR_NODE_GROUPS__, { timeout: 120000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const out = {};
  for (const id of ['orr-materia-brass', 'orr-materia-sapphire']) {
    const wrapper = window.__PRISM_EDITOR_NODE_GROUPS__.get(id);
    if (!wrapper) { out[id] = null; continue; }
    const meshes = [];
    wrapper.traverse((o) => {
      if (o.isMesh) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        meshes.push({
          name: o.name || '(unnamed)',
          geo: o.geometry?.type,
          matType: m?.type ?? m?.constructor?.name,
          hasMap: !!m?.map,
          hasColorNode: !!m?.colorNode,
          color: m?.color ? '#' + m.color.getHexString() : null,
        });
      }
    });
    out[id] = meshes;
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close(); server.kill('SIGTERM'); process.exit(0);

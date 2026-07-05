import { chromium } from 'playwright';
const OUT = 'notes/verification/editor-experience/F4b-HUBS';

// nav-link nodeIds per source hub, keyed by target hub (from live-graph.json)
const NAVLINK = {
  's1-arrival':  { 's1-arrival': 'shell-nav-arrival', 's2-movement': 'shell-nav-movement', 's3-materia': 'shell-nav-materia', 's4-celestia': 'shell-nav-celestia', 's5-acquire': 'shell-nav-acquire' },
  's2-movement': { 's1-arrival': 'shell-2_movement-nav-arrival', 's2-movement': 'shell-2_movement-nav-movement', 's3-materia': 'shell-2_movement-nav-materia', 's4-celestia': 'shell-2_movement-nav-celestia', 's5-acquire': 'shell-2_movement-nav-acquire' },
  's3-materia':  { 's1-arrival': 'shell-3_materia-nav-arrival', 's2-movement': 'shell-3_materia-nav-movement', 's3-materia': 'shell-3_materia-nav-materia', 's4-celestia': 'shell-3_materia-nav-celestia', 's5-acquire': 'shell-3_materia-nav-acquire' },
  's4-celestia': { 's1-arrival': 'shell-4_celestia-nav-arrival', 's2-movement': 'shell-4_celestia-nav-movement', 's3-materia': 'shell-4_celestia-nav-materia', 's4-celestia': 'shell-4_celestia-nav-celestia', 's5-acquire': 'shell-4_celestia-nav-acquire' },
  's5-acquire':  { 's1-arrival': 'shell-5_acquire-nav-arrival', 's2-movement': 'shell-5_acquire-nav-movement', 's3-materia': 'shell-5_acquire-nav-materia', 's4-celestia': 'shell-5_acquire-nav-celestia', 's5-acquire': 'shell-5_acquire-nav-acquire' },
};
// traversal order — drive each step using the CURRENT hub's own header nav link
const STEPS = [
  { from: null,          to: 's1-arrival',  file: 'arrival.png'  },
  { from: 's1-arrival',  to: 's2-movement', file: 'movement.png' },
  { from: 's2-movement', to: 's3-materia',  file: 'materia.png'  },
  { from: 's3-materia',  to: 's4-celestia', file: 'celestia.png' },
  { from: 's4-celestia', to: 's5-acquire',  file: 'acquire.png'  },
];

const b = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 220)); });
p.on('pageerror', e => errs.push('PAGEERROR ' + (e.message || '').slice(0, 220)));

await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(4500);

// dismiss guided walkthrough
for (const fn of [
  async () => { await p.getByText('SKIP', { exact: false }).first().click({ timeout: 2500 }); },
  async () => { await p.locator('[aria-label="Close"],[aria-label="close"],button:has-text("×")').first().click({ timeout: 1500 }); },
  async () => { await p.keyboard.press('Escape'); },
]) { try { await fn(); await p.waitForTimeout(500); } catch {} }

// enter PREVIEW APP mode
let previewClicked = false;
try { await p.getByText('Preview App', { exact: false }).first().click({ timeout: 4000 }); previewClicked = true; }
catch (e) { console.log('preview_click_fail', e.message); }
await p.waitForTimeout(6500); // let app + watch settle

// wait for preview-app nav API + screen-rect projector
let ready = false;
for (let i = 0; i < 24; i++) {
  ready = await p.evaluate(() => !!(window.__PRISM_EDITOR_PREVIEW_APP_NAV__ && window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__));
  if (ready) break;
  await p.waitForTimeout(500);
}
const hubIds = await p.evaluate(() => { try { return window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.hubIds ?? []; } catch { return []; } });
console.log('preview_clicked=' + previewClicked + ' hooks_ready=' + ready + ' hubIds=' + JSON.stringify(hubIds));

// Click the in-scene nav-link node for `targetHub` (rendered in the current hub's header).
async function clickNavLink(nodeId) {
  const rect = await p.evaluate((nodeId) => {
    const r = window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(nodeId);
    return r;
  }, nodeId);
  if (!rect || !rect.inFrustum) return { clicked: false, reason: rect ? 'not-in-frustum' : 'no-rect', rect };
  // rect is normalized 0..1, y-down (screenshot space) → CSS pixels (viewport 1440x900)
  const x = rect.cx * 1440;
  const y = rect.cy * 900;
  await p.mouse.move(x, y);
  await p.waitForTimeout(120);
  await p.mouse.click(x, y);
  return { clicked: true, x, y, rect };
}

const results = [];
for (const step of STEPS) {
  let navMethod = 'unknown';
  let landed = null;
  if (step.from === null) {
    // boot hub — normalize to arrival via the exposed nav (boot default is preview-app/arrival)
    landed = await p.evaluate((id) => { try { return window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.goTo(id) ?? null; } catch { return null; } }, step.to);
    navMethod = 'boot/normalize';
  } else {
    const nodeId = NAVLINK[step.from][step.to];
    const click = await clickNavLink(nodeId);
    if (click.clicked) {
      await p.waitForTimeout(1800);
      const cur = await p.evaluate(() => { try { return window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.activeHubId ?? null; } catch { return null; } });
      if (cur === step.to) { navMethod = 'header-nav-click(' + nodeId + ')'; landed = cur; }
      else { navMethod = 'click-fired-but-hub=' + cur; landed = cur; }
    }
    if (landed !== step.to) {
      // fallback to the exposed navigate (same activeHubId-swap path) so we still capture the frame
      const reason = click.clicked ? 'click-no-land' : click.reason;
      landed = await p.evaluate((id) => { try { return window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.goTo(id) ?? null; } catch { return null; } }, step.to);
      navMethod = 'api-fallback(' + reason + ')';
    }
  }
  await p.waitForTimeout(2800); // let hub transition + animations settle before shot
  await p.screenshot({ path: OUT + '/' + step.file });
  results.push({ to: step.to, file: step.file, navMethod, landed, ok: landed === step.to });
  console.log('STEP from=' + step.from + ' to=' + step.to + ' method=' + navMethod + ' landed=' + landed + ' ok=' + (landed === step.to));
}

console.log('RESULTS=' + JSON.stringify(results));
console.log('console_errors=' + errs.length);
errs.slice(0, 15).forEach(e => console.log(' !', e));
await b.close();
console.log('DONE');

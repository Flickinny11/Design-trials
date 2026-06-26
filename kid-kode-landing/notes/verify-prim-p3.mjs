// PRIM-P3 BEHAVIORAL VERIFICATION — /fluid-lab. Headless/offscreen Playwright,
// near-human: drives the REAL in-canvas Inspector faders (projected pointer events,
// the primitive-lab idiom), confirms each param VISIBLY changes the GPU fluid, the
// liquid-glass expand timeline runs, and motion is real. Frames + metrics → notes/.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const BASE = process.env.PRIM_BASE || 'http://localhost:3000';
const OUT = 'notes/verification/prim-p3';
mkdirSync(OUT, { recursive: true });

async function diff(aBuf, bBuf, crop) {
  const prep = (x) => { let s = sharp(x); if (crop) s = s.extract(crop); return s.resize(560, 360, { fit: 'fill' }).removeAlpha().raw().toBuffer(); };
  const a = await prep(aBuf), b = await prep(bBuf);
  let sum = 0, changed = 0, max = 0;
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); sum += d; if (d > 14) changed++; if (d > max) max = d; }
  return { meanAbsDiff: +(sum / a.length).toFixed(3), changedPct: +(100 * changed / a.length).toFixed(2), max };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
const M = { steps: [], errors: [] };
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); return page.screenshot(); };

await page.goto(`${BASE}/fluid-lab`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => !!window.__PRISM_FLUID_AUTHORSHIP__ && !!window.__PRISM_FLUID_INSPECTOR_MAP__ && window.__PRISM_FLUID_STORE__().schemas.length > 0, { timeout: 60000 });
await page.waitForTimeout(4500);

M.backend = await page.evaluate(() => window.__PRISM_FLUID_BACKEND__());
const auth0 = await page.evaluate(() => window.__PRISM_FLUID_AUTHORSHIP__());
M.authorship = { ok: auth0.ok, rendered: auth0.renderedCount, nodes: auth0.nodeIds.length, orphans: auth0.orphans.length };
console.log('BACKEND', JSON.stringify(M.backend), 'AUTH ok=%s rendered=%d', auth0.ok, auth0.renderedCount);

// ── 1) instantiate creates a backing node (Node Law) ──
M.instantiate = await page.evaluate(() => {
  const st = window.__PRISM_FLUID_STORE__();
  const before = st.nodes().length;
  st.instantiate('surface');
  const after = window.__PRISM_FLUID_STORE__().nodes().length;
  const id = window.__PRISM_FLUID_STORE__().schemas.slice(-1)[0].nodeId;
  window.__PRISM_FLUID_STORE__().remove(id); // clean up the probe node
  return { before, after, created: after === before + 1 };
});
console.log('INSTANTIATE created=%s (%d→%d)', M.instantiate.created, M.instantiate.before, M.instantiate.after);

// select the surface node
const surfaceId = await page.evaluate(() => {
  const st = window.__PRISM_FLUID_STORE__();
  const s = st.schemas.find((x) => x.kind === 'surface') || st.schemas[0];
  st.select(s.nodeId);
  return s.nodeId;
});
await page.waitForTimeout(600);

// ── drag a real Inspector fader (projected pointer events) ──
async function fader(key) { const map = await page.evaluate(() => window.__PRISM_FLUID_INSPECTOR_MAP__()); return { map, f: map.faders.find((x) => x.key === key) }; }
function worldXFor(f, val) { return f.worldX0 + ((val - f.min) / (f.max - f.min)) * (f.worldX1 - f.worldX0); }
async function dragFader(key, targetVal) {
  const { map, f } = await fader(key);
  const cur = f.value;
  const xCur = worldXFor(f, cur), xTo = worldXFor(f, targetVal);
  const [sx0, sy0] = await page.evaluate(([x, y, z]) => window.__PRISM_FLUID_CAM__.project(x, y, z), [xCur, f.worldY, map.knobZ]);
  const [sx1, sy1] = await page.evaluate(([x, y, z]) => window.__PRISM_FLUID_CAM__.project(x, y, z), [xTo, f.worldY, map.knobZ]);
  await page.mouse.move(sx0, sy0); await page.mouse.down();
  const N = 14; for (let i = 1; i <= N; i++) { await page.mouse.move(sx0 + (sx1 - sx0) * i / N, sy0 + (sy1 - sy0) * i / N); await page.waitForTimeout(12); }
  await page.mouse.up();
  await page.waitForTimeout(300);
  const newVal = await page.evaluate((k) => { const st = window.__PRISM_FLUID_STORE__(); const s = st.schemas.find((x) => x.nodeId === st.selectedId); return s.params[k]; }, key);
  return { from: cur, to: newVal, target: targetVal };
}

// fluid sits roughly left-of-centre; crop to the surface region for cleaner diffs.
const FLUID_CROP = { left: 90, top: 280, width: 640, height: 420 };

// ── 2) THICKNESS / FLOW / VISCOSITY: drag fader → param changes + fluid responds ──
for (const [key, lo, hi, label] of [['thickness', 0.35, 2.4, 'thickness'], ['flowSpeed', 0.08, 1.85, 'flow'], ['viscosity', 0.05, 0.97, 'viscosity']]) {
  try {
    await page.evaluate((id) => window.__PRISM_FLUID_SET_PARAM__(id, { flowSpeed: 0.6, turbulence: 0.3, thickness: 1.4, viscosity: 0.7 }), surfaceId);
    await page.waitForTimeout(1100);
    const dLo = await dragFader(key, lo); await page.waitForTimeout(1100); const fLo = await shot(`bh-${label}-lo`);
    const dHi = await dragFader(key, hi); await page.waitForTimeout(1100); const fHi = await shot(`bh-${label}-hi`);
    const dv = await diff(fLo, fHi, FLUID_CROP);
    const changed = Math.abs(dLo.to - dHi.to) > (hi - lo) * 0.4;
    M.steps.push({ control: key, faderMovedFrom: +dLo.from.toFixed(3), toLow: +dLo.to.toFixed(3), toHigh: +dHi.to.toFixed(3), paramChanged: changed, visualDiff: dv });
    console.log('FADER %s: %s→%s then →%s | paramChanged=%s visualDiff=%s%%', key, dLo.from.toFixed(2), dLo.to.toFixed(2), dHi.to.toFixed(2), changed, dv.changedPct);
  } catch (e) { M.steps.push({ control: key, error: String(e).slice(0, 120) }); console.log('FADER %s ERROR %s', key, String(e).slice(0, 80)); }
}

// ── 3) pattern chips: click each → pattern changes ──
try {
  const map = await page.evaluate(() => window.__PRISM_FLUID_INSPECTOR_MAP__());
  const results = [];
  for (const p of map.patterns) {
    const [sx, sy] = await page.evaluate(([x, y, z]) => window.__PRISM_FLUID_CAM__.project(x, y, z), p.worldPos);
    await page.mouse.click(sx, sy); await page.waitForTimeout(220);
    const cur = await page.evaluate(() => { const st = window.__PRISM_FLUID_STORE__(); return st.schemas.find((x) => x.nodeId === st.selectedId).params.pattern; });
    results.push({ clicked: p.pattern, got: cur, ok: cur === p.pattern });
  }
  M.patterns = results;
  console.log('PATTERNS', results.map((r) => `${r.clicked}:${r.ok}`).join(' '));
} catch (e) { M.patterns = { error: String(e).slice(0, 120) }; console.log('PATTERNS ERROR', String(e).slice(0, 80)); }

// ── 4) GO LIQUID expand timeline (phase 0 solid → 1 flowing) ──
try {
  await page.evaluate((id) => window.__PRISM_FLUID_SET_PARAM__(id, { flowSpeed: 0.8, turbulence: 0.4, thickness: 1.5, viscosity: 0.6 }), surfaceId);
  await page.evaluate(() => window.__PRISM_FLUID_SET_PHASE__(0)); await page.waitForTimeout(800);
  const solid = await shot('bh-goliquid-solid');
  await page.evaluate(() => window.__PRISM_FLUID_TRIGGER_LIQUID__()); await page.waitForTimeout(1600);
  const liquid = await shot('bh-goliquid-liquid');
  M.goLiquid = await diff(solid, liquid, FLUID_CROP);
  console.log('GO LIQUID solid→liquid visualDiff=%s%%', M.goLiquid.changedPct);
} catch (e) { M.goLiquid = { error: String(e).slice(0, 120) }; console.log('GO LIQUID ERROR', String(e).slice(0, 80)); }

// ── 5) motion over time (the sim genuinely evolves) ──
try {
  const t0 = await shot('bh-motion-t0'); await page.waitForTimeout(800); const t1 = await shot('bh-motion-t1');
  M.motion = await diff(t0, t1, FLUID_CROP);
  console.log('MOTION over 0.8s visualDiff=%s%%', M.motion.changedPct);
} catch (e) { M.motion = { error: String(e).slice(0, 120) }; console.log('MOTION ERROR', String(e).slice(0, 80)); }

// ── 6) galaxy/canvas two-state ──
try {
  await page.evaluate(() => window.__PRISM_FLUID_STORE__().setView('galaxy')); await page.waitForTimeout(1100);
  await shot('bh-galaxy');
  const galaxyAuth = await page.evaluate(() => window.__PRISM_FLUID_AUTHORSHIP__());
  M.galaxy = { view: galaxyAuth.view, orphans: galaxyAuth.orphans.length, rendered: galaxyAuth.renderedCount };
  await page.evaluate(() => window.__PRISM_FLUID_STORE__().setView('canvas')); await page.waitForTimeout(700);
} catch (e) { M.galaxy = { error: String(e).slice(0, 120) }; console.log('GALAXY ERROR', String(e).slice(0, 80)); }

M.errors = errors;
writeFileSync(`${OUT}/behavioral-metrics.json`, JSON.stringify(M, null, 2));
console.log('CONSOLE ERRORS', errors.length);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
await browser.close();
console.log('VERIFY-DONE');

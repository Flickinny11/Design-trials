// HEADLESS behavioral verification — EDIT-I3 w-keyframe.
// Proves the docked KEYFRAME panel animates the SELECTED node on the live graph:
//  • a TRUSTED track-fader drag writes a keyframe at the playhead (node.keyframes);
//  • a 2nd keyframe at a later time; scrubbing the playhead INTERPOLATES and the
//    realized node MOVES (its group y tracks the eased value);
//  • PLAY advances the playhead; authorship clean; 0 console errors.
// Offscreen (headless). Frames → notes/verification/edit-i3/.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = 'notes/verification/edit-i3';
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const project = (world) => page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), world);
const kf = () => page.evaluate(() => window.__PRISM_EDITOR_KEYFRAME__());
const faders = () => page.evaluate(() => window.__PRISM_EDITOR_FADER_LIST__());

async function dragFader(id, dir) {
  const list = await faders();
  const f = list.find((x) => x.id === id);
  if (!f) return false;
  const start = await project(f.knob);
  const target = await project(dir === 'right' ? f.right : f.left);
  await page.mouse.move(start[0], start[1]);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(start[0] + (target[0] - start[0]) * (i / 6), start[1] + (target[1] - start[1]) * (i / 6));
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(450);
  return true;
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_KEYFRAME__ === 'function'
      && typeof w.__PRISM_EDITOR_KF_SET_PLAYHEAD__ === 'function'
      && typeof w.__PRISM_EDITOR_FADER_LIST__ === 'function'
      && typeof w.__PRISM_EDITOR_TOOLBAR_FN__ === 'function'
      && typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0;
  }, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2600);

  // create + select a cube; the keyframe panel binds to it
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('object3d'));
  await page.waitForTimeout(1200);
  const cubeId = (await page.evaluate(() => window.__PRISM_EDITOR_INSPECTOR__().nodeId));
  const k0 = await kf();
  ok('panel-binds-selection', k0.selectedId === cubeId && k0.keyframeCount === 0, `sel=${cubeId?.slice(0,8)} kfs=${k0.keyframeCount}`);
  await page.screenshot({ path: `${OUT}/kf-01-panel.png` });

  // ── keyframe 1 at t=0 (drag RISE up) ────────────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(0));
  await page.waitForTimeout(300);
  await dragFader('kf:posY', 'right');
  const k1 = await kf();
  ok('keyframe-1-written', k1.keyframeCount >= 1, `kfs=${k1.keyframeCount} posY@0=${k1.eval.posY?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/kf-02-key1.png` });

  // ── keyframe 2 at t=2.5 (drag RISE down) ────────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(2.5));
  await page.waitForTimeout(300);
  await dragFader('kf:posY', 'left');
  const k2 = await kf();
  ok('keyframe-2-written', k2.keyframeCount >= 2, `kfs=${k2.keyframeCount} posY@2.5=${k2.eval.posY?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/kf-03-key2.png` });

  // ── scrub interpolates + the node animates (group y tracks the eased value) ──
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(0));
  await page.waitForTimeout(350);
  const at0 = await kf();
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(2.5));
  await page.waitForTimeout(350);
  const at25 = await kf();
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(1.25));
  await page.waitForTimeout(350);
  const atMid = await kf();
  const interp = atMid.eval.posY > Math.min(at0.eval.posY, at25.eval.posY) + 0.05
    && atMid.eval.posY < Math.max(at0.eval.posY, at25.eval.posY) - 0.05;
  const nodeMoved = at0.groupY != null && at25.groupY != null && Math.abs(at0.groupY - at25.groupY) > 0.3;
  ok('scrub-interpolates', interp, `posY @0=${at0.eval.posY?.toFixed(2)} @1.25=${atMid.eval.posY?.toFixed(2)} @2.5=${at25.eval.posY?.toFixed(2)}`);
  ok('node-animates-on-scrub', nodeMoved, `groupY @0=${at0.groupY?.toFixed(2)} @2.5=${at25.groupY?.toFixed(2)} Δ=${at0.groupY != null && at25.groupY != null ? Math.abs(at0.groupY - at25.groupY).toFixed(2) : 'n/a'}`);
  await page.screenshot({ path: `${OUT}/kf-04-scrub-mid.png` });

  // ── PLAY advances the playhead ──────────────────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(0));
  await page.evaluate(() => window.__PRISM_EDITOR_KF_PLAY__(true));
  await page.waitForTimeout(1500);
  const playing = await kf();
  await page.evaluate(() => window.__PRISM_EDITOR_KF_PLAY__(false));
  // headless rAF throttles offscreen (the tick caps dt at 0.05s/frame), so the
  // playhead advances slowly here; any forward motion proves the play clock runs.
  ok('play-advances', playing.playhead > 0.05, `playhead after play (headless rAF-throttled) = ${playing.playhead?.toFixed(2)}s`);
  await page.screenshot({ path: `${OUT}/kf-05-playing.png` });

  // ── authorship + console ────────────────────────────────────────────────────
  const auth = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('canvas-authorship-ok', auth.ok === true, `orphans=${auth.orphans.length} rendered=${auth.renderedCount}`);
  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== EDIT-I3 keyframe: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

#!/usr/bin/env node
// P0 ORRERY in-context verification — re-run the five FIXED primitives inside
// the ORRERY No.7 showcase where the bugs were originally discovered
// (UI-FIDELITY-2 advocate r1). Overlays temporary animationBindings onto the
// live graph (backed up + restored), boots the real app, drives the real
// Driver hub via window.__prismDrivers, and captures DPR-2 evidence frames +
// numeric subject samples into notes/verification/p0-orrery/.
//
// Bindings under test (the exact discovery sites):
//   orr-arrival-headline  scroll-depth-dolly [scroll]  (the node it KILLED)
//   orr-arrival-sub       decode-text        [time]
//   orr-materia-brass     scroll-stagger-rise[scroll]  (textured plane)
//   orr-materia-sapphire  pointer-shine      [pointer] (textured plane)
//   orr-materia-pour      embers             [time]
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = '4823';
const LIVE = 'public/prism-mock/home/live-graph.json';
const BACKUP = `${LIVE}.p0-backup`;
const OUT = 'notes/verification/p0-orrery';
mkdirSync(OUT, { recursive: true });

const OVERLAY = {
  'orr-arrival-headline': { primitive: 'scroll-depth-dolly', driver: 'scroll', params: {} },
  'orr-arrival-sub': { primitive: 'decode-text', driver: 'time', params: {} },
  'orr-materia-brass': { primitive: 'scroll-stagger-rise', driver: 'scroll', params: {} },
  'orr-materia-sapphire': { primitive: 'pointer-shine', driver: 'pointer', params: {} },
  'orr-materia-pour': { primitive: 'embers', driver: 'time', params: {} },
};

// ── overlay ────────────────────────────────────────────────────────────────
copyFileSync(LIVE, BACKUP);
const graph = JSON.parse(readFileSync(LIVE, 'utf8'));
const allNodes = graph.hubs ? graph.hubs.flatMap((h) => h.nodes ?? []) : (graph.nodes ?? []);
let added = 0;
const visit = (node) => {
  const spec = OVERLAY[node.nodeId];
  if (!spec) return;
  node.animationBindings = [
    ...(node.animationBindings ?? []),
    { id: `p0-verify-${node.nodeId}`, primitive: spec.primitive, driver: spec.driver, params: spec.params, order: 99 },
  ];
  added++;
};
if (graph.hubs) for (const h of graph.hubs) (h.nodes ?? []).forEach(visit);
if (graph.nodes) graph.nodes.forEach(visit);
writeFileSync(LIVE, JSON.stringify(graph, null, 1));
console.log(`overlaid ${added}/5 bindings (graph shape: ${graph.hubs ? 'hubs[]' : 'flat'})`);
if (added !== 5) {
  console.log('node ids found:', JSON.stringify(allNodes.slice(0, 8).map((n) => n.nodeId)));
}

const restore = () => {
  try { copyFileSync(BACKUP, LIVE); console.log('live-graph.json restored'); } catch (e) { console.log('RESTORE FAILED', e.message); }
};
process.on('exit', restore);

// ── boot ───────────────────────────────────────────────────────────────────
const server = spawn('npx', ['next', 'dev', '-p', PORT], { cwd: process.cwd(), stdio: 'pipe', env: process.env });
const BASE = `http://localhost:${PORT}`;
const deadline = Date.now() + 180000;
while (Date.now() < deadline) {
  try { const r = await fetch(BASE); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1500));
}

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--headless=new', '--enable-unsafe-webgpu', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
const skips = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  const t = m.text();
  if (t.includes('[animation-bindings]')) skips.push(t);
});

const report = { bindings: {}, samples: {}, consoleErrors: 0, skips: [] };
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`  ✓ ${name}.png`); };

// Sample the MOUNTED SUBJECT (what bindings actually animate): the
// 'text-object' group for text nodes, else the first Mesh descendant.
const sample = (nodeId) => page.evaluate((id) => {
  const map = window.__PRISM_EDITOR_NODE_GROUPS__;
  const wrapper = map?.get(id);
  if (!wrapper) return null;
  let subj = null;
  wrapper.traverse((o) => { if (!subj && o.name === 'text-object') subj = o; });
  if (!subj) wrapper.traverse((o) => { if (!subj && o.isMesh) subj = o; });
  if (!subj) return { found: false };
  let op = null;
  subj.traverse((o) => { if (op === null && o.isMesh && o.material && !Array.isArray(o.material)) op = o.material.opacity; });
  return { found: true, z: +subj.position.z.toFixed(3), scale: +subj.scale.x.toFixed(3), opacity: op === null ? null : +(+op).toFixed(3), visible: subj.visible };
}, nodeId);

const counts = () => page.evaluate((ids) => {
  const d = window.__prismDrivers;
  const out = {};
  for (const id of ids) out[id] = d ? d.nodeResultCount(id) : -1;
  return out;
}, Object.keys(OVERLAY));

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.__prismDrivers && !!window.__PRISM_EDITOR_NODE_GROUPS__, { timeout: 120000 });
  // Late-subject retry window: GLB/MSDF artifacts mount async; bindings poll-attach.
  await page.waitForFunction(() => {
    const d = window.__prismDrivers;
    return d && d.nodeResultCount('orr-arrival-headline') >= 1 && d.nodeResultCount('orr-arrival-sub') >= 1;
  }, { timeout: 30000 }).catch(() => console.log('  ! arrival bindings did not attach in 30s'));
  await page.waitForTimeout(2500);

  report.bindings.arrivalAttach = await counts();

  // A — scroll-depth-dolly on the headline (the original kill site).
  await page.evaluate(() => window.__prismDrivers.setScroll(0));
  await page.waitForTimeout(700);
  report.samples.headlineScroll0 = await sample('orr-arrival-headline');
  await shot('s1-arrival-scroll0');
  await page.evaluate(() => window.__prismDrivers.setScroll(0.5));
  await page.waitForTimeout(700);
  report.samples.headlineScroll05 = await sample('orr-arrival-headline');
  await shot('s1-arrival-scroll05');
  await page.evaluate(() => window.__prismDrivers.setScroll(0.9));
  await page.waitForTimeout(700);
  report.samples.headlineScroll09 = await sample('orr-arrival-headline');
  await shot('s1-arrival-scroll09');
  await page.evaluate(() => window.__prismDrivers.setScroll(0));
  await page.waitForTimeout(500);

  // B — decode-text on the sub (time driver, looping): two frames apart differ;
  // timeline progress advances.
  report.samples.subTimeline1 = await page.evaluate(() => window.__prismDrivers.timelineState('orr-arrival-sub'));
  await shot('s1-decode-a');
  await page.waitForTimeout(650);
  await shot('s1-decode-b');
  report.samples.subTimeline2 = await page.evaluate(() => window.__prismDrivers.timelineState('orr-arrival-sub'));

  // C — navigate to materia (hash routing) for the three texture-context tiles.
  await page.evaluate(() => { location.hash = '#hub=s3-materia'; });
  await page.waitForTimeout(3500); // page-turn conductor + mounts
  await page.waitForFunction(() => {
    const d = window.__prismDrivers;
    return d && d.nodeResultCount('orr-materia-brass') >= 1 && d.nodeResultCount('orr-materia-sapphire') >= 1 && d.nodeResultCount('orr-materia-pour') >= 1;
  }, { timeout: 30000 }).catch(() => console.log('  ! materia bindings did not attach in 30s'));
  report.bindings.materiaAttach = await counts();

  // stagger-rise on the brass swatch: hidden at 0, arriving at 0.6, assembled at 1.
  await page.evaluate(() => window.__prismDrivers.setScroll(0));
  await page.waitForTimeout(700);
  report.samples.brassScroll0 = await sample('orr-materia-brass');
  await shot('s3-materia-scroll0');
  await page.evaluate(() => window.__prismDrivers.setScroll(0.6));
  await page.waitForTimeout(700);
  await shot('s3-materia-scroll06');
  await page.evaluate(() => window.__prismDrivers.setScroll(1));
  await page.waitForTimeout(700);
  report.samples.brassScroll1 = await sample('orr-materia-brass');
  await shot('s3-materia-scroll1');

  // D — pointer-shine on the sapphire swatch: glint tracks the pointer.
  await page.evaluate(() => window.__prismDrivers.setPointer(-0.35, 0.05));
  await page.waitForTimeout(600);
  await shot('s3-shine-left');
  await page.evaluate(() => window.__prismDrivers.setPointer(0.35, -0.1));
  await page.waitForTimeout(600);
  await shot('s3-shine-right');
  report.samples.sapphire = await sample('orr-materia-sapphire');

  // E — embers near the molten pour (time driver): frames apart differ.
  await shot('s3-embers-a');
  await page.waitForTimeout(900);
  await shot('s3-embers-b');
} finally {
  report.consoleErrors = errors.length;
  report.errorSamples = errors.slice(0, 5);
  report.skips = skips.slice(0, 10);
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ consoleErrors: errors.length, skips: skips.length }, null, 0));
  await browser.close();
  server.kill('SIGTERM');
}
console.log('report → notes/verification/p0-orrery/report.json');
process.exit(0);

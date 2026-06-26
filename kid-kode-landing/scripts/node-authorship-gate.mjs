#!/usr/bin/env node
// node-authorship-gate — the standalone enforcement half of PRISM-MASTER-SPEC
// **Law 0** ("every artifact is a node") + its verification corollary. It is
// the gate the Wave-1 foundation audit (notes/AUDIT-INTEGRITY-REPORT.md) called
// for: verification must assert NODE AUTHORSHIP, not merely that an object of a
// given name exists in the scene. Name/count-only checks passed the three
// hardcoded signature artifacts (configurator watch / orrery complication /
// hub transition); this gate catches them.
//
// What it does (drives a RUNNING dev/preview server in headless Chromium):
//   1. Boots the app to preview-app, waits for window.__PRISM_NODE_AUTHORSHIP__.
//   2. Visits the hubs that host the signature rigs (s4-celestia → orrery,
//      s6-atelier → watch; the hub-transition curtain is always mounted in
//      preview-app) and UNIONS the authorship report across hubs.
//   3. Classifies every content artifact as node-authored (carries an authoring
//      nodeId) or hardcoded (mounted outside the node map → nodeId null).
//   4. FAILS on UNSANCTIONED hardcoded drift. The 3 known signature artifacts
//      are EXPECTED-known (warn, pending their G1/G2/G3 greenlight sessions) —
//      the gate MUST currently flag them, which is the proof it works.
//   5. Cross-checks every node-authored id against the live graph, and (the G5
//      orphan fix) reports the 7 former-orphan nodeIds: the 6 removed ambience
//      planes must be ABSENT from the graph; orr-atelier-reason must carry real
//      text. With --strict-orphans those orphan checks are fatal (Wave-3 gate).
//
// Usage:
//   node scripts/node-authorship-gate.mjs [url] [--strict-orphans]
//   GATE_URL=http://localhost:3000 node scripts/node-authorship-gate.mjs
// Assumes the server is already running (Wave-3 manages `npm run dev` on :3000).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'fix1');
mkdirSync(outDir, { recursive: true });

const argv = process.argv.slice(2);
const STRICT_ORPHANS = argv.includes('--strict-orphans');
// PRIM-P1: `--lab` extends Law-0 coverage to the Primitive System instantiation
// pipeline at /primitive-lab — a primitive rendered without a backing node FAILS.
const LAB = argv.includes('--lab');
// PRIM-P2: `--mat` extends Law-0 coverage to the Material System review surface at
// /material-lab — the 3 display primitives must each map to a backing node, and
// applying a library material must never orphan a render.
const MAT = argv.includes('--mat');
// PRIM-P3: `--fluid` extends Law-0 coverage to the Fluid System review surface at
// /fluid-lab — every instantiated fluid (surface/volume) must map to a backing node,
// and editing fluid params or triggering liquid glass must never orphan a render.
const FLUID = argv.includes('--fluid');
const URL = (argv.find((a) => /^https?:\/\//.test(a)) || process.env.GATE_URL || 'http://localhost:3000') + '';
const LAB_URL = URL.replace(/\/$/, '') + '/primitive-lab';
const MAT_URL = URL.replace(/\/$/, '') + '/material-lab';
const FLUID_URL = URL.replace(/\/$/, '') + '/fluid-lab';

// Source of truth: src/lib/prism/runtime/node-authorship.ts EXPECTED_HARDCODED_ARTIFACTS.
// THE FOUNDATION IS NOW CLEAN — this set is EMPTY:
//   FIX2 / G1 — 'configurator-watch' → graph node orr-atelier-watch.
//   FIX3 / G2 — 'orrery-complication' → graph node orr-celestia-orrery.
//   FIX3 / G3 — 'hub-transition' → an intentional tagged RUNTIME HOST (not a
//               hub artifact; classified kind 'runtime-host', not drift).
// ANY hardcoded artifact the gate now flags is unsanctioned Law-0 drift → FAIL.
const EXPECTED_HARDCODED = [];
// The 7 former orphans (AUDIT C4 / G5). 6 ambience planes → REMOVED; 1 text node kept+filled.
const ORPHAN_PLANES_REMOVED = [
  'orr-arrival-dust', 'orr-movement-rings', 'orr-celestia-starfield',
  'orr-celestia-galaxy', 'orr-celestia-orbits', 'orr-acquire-sweep',
];
const ORPHAN_TEXT_KEPT = 'orr-atelier-reason';
// Hubs to visit so every signature rig mounts (preview-app, by activeHubId).
const RIG_HUBS = ['s4-celestia', 's6-atelier'];

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const results = [];
function check(id, desc, pass, detail = '', warn = false) {
  results.push({ id, desc, pass, warn, detail });
  const tag = pass ? (warn ? YELLOW + 'WARN' : GREEN + 'PASS') : RED + 'FAIL';
  console.log(`[${tag}${RESET}] ${id.padEnd(34)} ${desc}${detail ? `\n        ${DIM}${detail}${RESET}` : ''}`);
}

function loadGraph() {
  const p = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
  const g = JSON.parse(readFileSync(p, 'utf8'));
  const byId = new Map((g.nodes || []).map((n) => [n.nodeId, n]));
  return { graph: g, byId };
}

/** A node has a "real artifact source" when it would pass hasArtifactData OR is
 *  a text node with non-empty content (mirrors ArtifactNode.hasArtifactData +
 *  the text branch). */
function hasRealArtifact(n) {
  if (!n) return false;
  if (n.visual?.sourceAsset) return true;
  if (n.meshUrl) return true;
  if (n.meshPrimitive) return true;
  if (n.codeRef) return true;
  if ((n.renderMode ?? 'sprite') === 'text') {
    return typeof n.textSpec?.content === 'string' && n.textSpec.content.trim().length > 0;
  }
  return false;
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const { byId } = loadGraph();

  if (!(await waitForServer(URL))) {
    check('server.up', `dev server reachable at ${URL}`, false, 'no 200 in 30s — start `npm run dev` first');
    finish();
    return;
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const unionByLabel = new Map(); // label → entry (hardcoded union)
  const runtimeHostsByLabel = new Map(); // label → entry (runtime-host union)
  const nodeAuthored = new Map(); // nodeId → max renderables seen
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Wait for the runtime to boot the probe + populate the node-group map.
    const booted = await page.waitForFunction(() => {
      const w = window;
      return typeof w.__PRISM_NODE_AUTHORSHIP__ === 'function'
        && w.__PRISM_EDITOR_NODE_GROUPS__ instanceof Map
        && w.__PRISM_EDITOR_NODE_GROUPS__.size > 0;
    }, { timeout: 60000 }).then(() => true).catch(() => false);
    check('probe.installed', 'window.__PRISM_NODE_AUTHORSHIP__ installed + node groups mounted', booted,
      booted ? '' : 'probe never appeared (runtime did not boot to a built scene)');
    if (!booted) { await browser.close(); finish(); return; }

    const capture = async () => {
      const rep = await page.evaluate(() => window.__PRISM_NODE_AUTHORSHIP__());
      for (const a of rep.artifacts) {
        if (a.kind === 'hardcoded') {
          const prev = unionByLabel.get(a.label);
          if (!prev || a.renderables > prev.renderables) unionByLabel.set(a.label, a);
        } else if (a.kind === 'runtime-host') {
          const prev = runtimeHostsByLabel.get(a.label);
          if (!prev || a.renderables > prev.renderables) runtimeHostsByLabel.set(a.label, a);
        } else if (a.nodeId) {
          nodeAuthored.set(a.nodeId, Math.max(nodeAuthored.get(a.nodeId) ?? 0, a.renderables));
        }
      }
      return rep;
    };

    const goHub = async (h) => {
      await page.evaluate((hub) => {
        const s = window.__PRISM_DEBUG_STORES__?.graphEditor;
        if (s) { const st = s.getState(); (st.flyToHub ? st.flyToHub(hub) : s.setState({ activeHubId: hub })); }
      }, h);
    };

    // Boot hub (transition curtain is mounted here in preview-app). Generous
    // settle so the cold MSDF text atlas warms before the first capture (glyph
    // meshes mount async — an unwarmed text node reads as 0 renderables).
    await page.waitForTimeout(4000);
    await capture();

    // Visit each rig hub so the watch + orrery mount, then re-capture.
    for (const hub of RIG_HUBS) {
      await goHub(hub);
      await page.waitForTimeout(2800);
      await capture();
    }
    // Return to the boot hub + settle, then a FINAL union capture so any text
    // that was still warming on the first pass is now counted (union via max).
    await goHub('s1-arrival');
    await page.waitForTimeout(3500);
    await capture();

    const hardcoded = [...unionByLabel.values()];
    const hardLabels = hardcoded.map((h) => h.label.replace(/^hardcoded:/, ''));
    const runtimeHosts = [...runtimeHostsByLabel.values()];
    const hostLabels = runtimeHosts.map((h) => h.label.replace(/^runtime-host:/, ''));

    // ── PROOF-OF-LIFE (self-test): the foundation is now CLEAN, so the real scene
    //    has ZERO accidental hardcoded artifacts — which means we can no longer
    //    prove the classifier works by "did it flag any drift?". Instead run the
    //    classifier over a SYNTHETIC scene carrying one of each tag and assert it
    //    still discriminates hardcoded (drift) vs runtime-host (sanctioned) vs
    //    node-authored. If this passes, a real hardcoded artifact WOULD be caught.
    const self = await page.evaluate(() => window.__PRISM_NODE_AUTHORSHIP_SELFTEST__?.() ?? null);
    const selfHard = self?.artifacts?.find((a) => a.kind === 'hardcoded' && a.label.includes('__selftest-hardcoded__'));
    const selfHost = self?.artifacts?.find((a) => a.kind === 'runtime-host' && a.label.includes('__selftest-host__'));
    const selfNode = self?.artifacts?.find((a) => a.kind === 'node' && a.nodeId === '__selftest-node__');
    const classifierLive = !!selfHard && !!selfHost && !!selfNode;
    check('gate.classifier-live', 'classifier discriminates hardcoded vs runtime-host vs node (self-test)', classifierLive,
      classifierLive
        ? 'synthetic hardcoded→flagged, runtime-host→sanctioned, node→authored — a real drift WOULD be caught'
        : `self-test failed: hardcoded=${!!selfHard} runtimeHost=${!!selfHost} node=${!!selfNode}`);

    // ── THE HEADLINE: zero ACCIDENTAL hardcoded drift. EXPECTED_HARDCODED is now
    //    EMPTY — the watch + orrery are nodes, the transition is a tagged runtime
    //    host. ANY hardcoded artifact here is unsanctioned Law-0 drift → FAIL.
    const unexpected = hardLabels.filter((l) => !EXPECTED_HARDCODED.includes(l));
    check('gate.no-accidental-drift', 'ZERO accidental hardcoded artifacts (foundation clean — Law 0)', unexpected.length === 0,
      unexpected.length ? `UNSANCTIONED hardcoded drift: ${unexpected.join(', ')}` : 'foundation clean — no hardcoded artifact mounted outside the node map');

    // ── The hub-transition is recognised as an INTENTIONAL tagged runtime host
    //    (G3), NOT accidental drift. Prove the scan reaches + classifies it.
    const transitionRecognised = hostLabels.includes('hub-transition');
    check('runtime-host.hub-transition', 'hub transition classified as an intentional runtime host (not drift)', transitionRecognised,
      transitionRecognised
        ? `runtime hosts: ${hostLabels.join(', ')} — sanctioned cross-hub runtime behaviour, see docs/spec-deviations-prism.md`
        : 'hub-transition NOT seen as a runtime host this run (curtain may not have mounted — it mounts in preview-app)');

    // ── Node-authored sanity: every reported authoring nodeId exists in the graph.
    const phantom = [...nodeAuthored.keys()].filter((id) => !byId.has(id));
    check('authored.in-graph', 'every node-authored artifact maps to a real graph node', phantom.length === 0,
      phantom.length ? `phantom ids: ${phantom.slice(0, 6).join(', ')}` : `${nodeAuthored.size} node-authored artifacts, all in graph`);

    // Node-authored artifacts that mounted but render nothing (orphan smell).
    // Split by renderMode: MSDF text glyphs warm ASYNC, so an empty `text` node
    // at capture time is usually just-not-warm (info), whereas an empty
    // non-text artifact (plane/mesh with no source) is the real FP-R3 orphan.
    const emptyAll = [...nodeAuthored.entries()].filter(([, r]) => r === 0).map(([id]) => id);
    const emptyNonText = emptyAll.filter((id) => (byId.get(id)?.renderMode ?? 'sprite') !== 'text');
    const emptyText = emptyAll.filter((id) => (byId.get(id)?.renderMode ?? 'sprite') === 'text');
    check('authored.renders', 'no non-text node-authored artifact mounted empty (FP-R3 orphan)', emptyNonText.length === 0,
      emptyNonText.length ? `empty: ${emptyNonText.slice(0, 8).join(', ')}` : 'all non-text node-authored artifacts render content',
      /* warn */ emptyNonText.length > 0 && !STRICT_ORPHANS);
    if (emptyText.length) {
      check('authored.text-warm', 'text nodes warmed (MSDF glyphs mounted)', false,
        `still warming at capture (async, non-fatal): ${emptyText.slice(0, 8).join(', ')}`, /* warn */ true);
    }

    // ── G5 orphan resolution (graph-level; fatal under --strict-orphans).
    const stillPresent = ORPHAN_PLANES_REMOVED.filter((id) => byId.has(id));
    check('orphans.planes-removed', '6 redundant ambience planes removed from the graph', stillPresent.length === 0,
      stillPresent.length ? `still present: ${stillPresent.join(', ')}` : 'all 6 removed (superseded by hub background[])',
      /* warn */ stillPresent.length > 0 && !STRICT_ORPHANS);

    const reason = byId.get(ORPHAN_TEXT_KEPT);
    const reasonOk = hasRealArtifact(reason);
    check('orphans.reason-filled', `${ORPHAN_TEXT_KEPT} kept + carries real text`, reasonOk,
      reasonOk ? `content: "${reason?.textSpec?.content ?? ''}"` : 'empty/absent — must carry on-brand resting copy',
      /* warn */ !reasonOk && !STRICT_ORPHANS);

    check('runtime.no-pageerrors', 'no uncaught page errors during the gate run', pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 2).join(' | ') : 'clean');

    writeFileSync(join(outDir, 'node-authorship-gate.json'), JSON.stringify({
      url: URL, strictOrphans: STRICT_ORPHANS,
      hardcoded, runtimeHosts, runtimeHostLabels: hostLabels,
      classifierSelfTest: { live: classifierLive, hardcoded: !!selfHard, runtimeHost: !!selfHost, node: !!selfNode },
      nodeAuthoredCount: nodeAuthored.size,
      emptyNonText, emptyText, unexpectedHardcoded: unexpected,
      orphanPlanesStillPresent: stillPresent, reasonContent: reason?.textSpec?.content ?? null,
      results,
    }, null, 2) + '\n');

    await page.screenshot({ path: join(outDir, 'gate-final-frame.png') }).catch(() => {});
    await browser.close();
  } catch (e) {
    check('fatal', 'gate fatal error', false, e?.message ?? String(e));
    try { await browser.close(); } catch { /* ignore */ }
  }
  finish();
}

// ── PRIM-P1 LAB MODE (spec §0 / INV-0.5) ────────────────────────────────────────
// Drives /primitive-lab and proves the Node Law for the Primitive System:
//   1. The authorship probe + self-test are live (classifier discriminates).
//   2. Instantiating a primitive CREATES a backing node in the same action.
//   3. In CANVAS, every node is REALIZED and every rendered primitive maps to a
//      node — ZERO orphans (a primitive rendered without a node = FAIL).
//   4. In GALAXY, every dormant seed maps to a node — ZERO orphans.
async function mainLab() {
  if (!(await waitForServer(URL))) {
    check('server.up', `dev server reachable at ${URL}`, false, 'no 200 in 30s — start `npm run dev` first');
    finish();
    return;
  }
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  try {
    await page.goto(LAB_URL, { waitUntil: 'domcontentloaded' });
    const booted = await page.waitForFunction(() => {
      const w = window;
      return typeof w.__PRISM_PRIM_AUTHORSHIP__ === 'function'
        && typeof w.__PRISM_PRIM_STORE__ === 'function'
        && w.__PRISM_PRIM_STORE__().schemas.length > 0;
    }, { timeout: 60000 }).then(() => true).catch(() => false);
    check('lab.probe.installed', 'window.__PRISM_PRIM_AUTHORSHIP__ installed + lab graph seeded', booted,
      booted ? '' : 'probe never appeared (route did not boot)');
    if (!booted) { await browser.close(); finish(); return; }
    await page.waitForTimeout(2500);

    // 1) classifier self-test — a synthetic unbacked render MUST be caught.
    const self = await page.evaluate(() => window.__PRISM_PRIM_AUTHORSHIP_SELFTEST__?.() ?? null);
    check('lab.classifier-live', 'authorship classifier discriminates backed vs orphan (self-test)', !!self?.live,
      self?.live ? 'synthetic orphan + untagged render both flagged — a real orphan WOULD be caught'
                 : `self-test failed: ${JSON.stringify(self)}`);

    // 2) instantiation CREATES a node in the same action (Node Law).
    const inst = await page.evaluate(async () => {
      const st = window.__PRISM_PRIM_STORE__();
      const before = st.nodes().length;
      window.__PRISM_PRIM_INSTANTIATE__?.('cube');
      const after = window.__PRISM_PRIM_STORE__().nodes().length;
      return { before, after };
    });
    check('lab.instantiate-creates-node', 'instantiating a primitive auto-creates a backing node', inst.after === inst.before + 1,
      `nodes ${inst.before} → ${inst.after}`);
    await page.waitForTimeout(900);

    // 3) CANVAS view — zero orphans, every node realized.
    await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('canvas'));
    await page.waitForTimeout(1200);
    const canvas = await page.evaluate(() => window.__PRISM_PRIM_AUTHORSHIP__());
    check('lab.canvas.no-orphan', 'CANVAS: every rendered primitive maps to a backing node (Law 0)', canvas.orphans.length === 0,
      canvas.orphans.length ? `ORPHANS: ${JSON.stringify(canvas.orphans)}` : `${canvas.renderedCount} rendered, all node-backed`);
    check('lab.canvas.all-realized', 'CANVAS: every node is realized (no node left unbuilt)', canvas.unrealizedInCanvas.length === 0,
      canvas.unrealizedInCanvas.length ? `unrealized: ${canvas.unrealizedInCanvas.join(', ')}` : `${canvas.nodeIds.length} nodes all realized`);

    // 4) GALAXY view — zero orphans (every dormant seed is node-backed).
    await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('galaxy'));
    await page.waitForTimeout(1200);
    const galaxy = await page.evaluate(() => window.__PRISM_PRIM_AUTHORSHIP__());
    check('lab.galaxy.no-orphan', 'GALAXY: every dormant seed maps to a backing node (Law 0)', galaxy.orphans.length === 0,
      galaxy.orphans.length ? `ORPHANS: ${JSON.stringify(galaxy.orphans)}` : `${galaxy.renderedCount} dormant seeds, all node-backed`);

    check('lab.no-pageerrors', 'no uncaught page errors during the lab gate run', pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 2).join(' | ') : 'clean');

    writeFileSync(join(outDir, 'primitive-authorship-gate.json'), JSON.stringify({
      url: LAB_URL, selfTest: self, instantiate: inst, canvas, galaxy, results,
    }, null, 2) + '\n');
    await page.screenshot({ path: join(outDir, 'lab-gate-final-frame.png') }).catch(() => {});
    await browser.close();
  } catch (e) {
    check('lab.fatal', 'lab gate fatal error', false, e?.message ?? String(e));
    try { await browser.close(); } catch { /* ignore */ }
  }
  finish();
}

// ── PRIM-P2 MAT MODE (spec §0 / INV-0.5) ────────────────────────────────────────
// Drives /material-lab and proves the Node Law for the Material System review
// surface: the authorship probe + self-test are live; every tagged display
// primitive maps to a backing node; applying any library material never orphans a
// render and leaves no node unrealized.
async function mainMat() {
  if (!(await waitForServer(URL))) {
    check('server.up', `dev server reachable at ${URL}`, false, 'no 200 in 30s — start `npm run dev` first');
    finish();
    return;
  }
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  try {
    await page.goto(MAT_URL, { waitUntil: 'domcontentloaded' });
    const booted = await page.waitForFunction(() => {
      const w = window;
      return typeof w.__PRISM_MAT_AUTHORSHIP__ === 'function'
        && typeof w.__PRISM_MAT_STORE__ === 'function'
        && w.__PRISM_MAT_STORE__().displays.length > 0;
    }, { timeout: 60000 }).then(() => true).catch(() => false);
    check('mat.probe.installed', 'window.__PRISM_MAT_AUTHORSHIP__ installed + display nodes seeded', booted,
      booted ? '' : 'probe never appeared (route did not boot)');
    if (!booted) { await browser.close(); finish(); return; }
    await page.waitForTimeout(2500);

    const self = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP_SELFTEST__?.() ?? null);
    check('mat.classifier-live', 'authorship classifier discriminates backed vs orphan (self-test)', !!self?.live,
      self?.live ? 'synthetic orphan + untagged render both flagged' : `self-test failed: ${JSON.stringify(self)}`);

    const before = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP__());
    check('mat.displays.no-orphan', 'every display primitive maps to a backing node (Law 0)', before.orphans.length === 0,
      before.orphans.length ? `ORPHANS: ${JSON.stringify(before.orphans)}` : `${before.renderedCount} rendered, all node-backed`);
    check('mat.displays.all-realized', 'every display node is realized (no node left unbuilt)', before.unrealized.length === 0,
      before.unrealized.length ? `unrealized: ${before.unrealized.join(', ')}` : `${before.nodeIds.length} nodes all realized`);

    // applying a material must not orphan anything.
    await page.evaluate(() => window.__PRISM_MAT_APPLY__('gem.ruby'));
    await page.waitForTimeout(700);
    const afterApply = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP__());
    check('mat.apply.no-orphan', 'applying a library material never orphans a render', afterApply.ok && afterApply.selectedMaterialId === 'gem.ruby',
      afterApply.ok ? `applied ${afterApply.selectedMaterialId}, ${afterApply.renderedCount} node-backed` : `FAIL: ${JSON.stringify(afterApply.orphans)}`);

    check('mat.no-pageerrors', 'no uncaught page errors during the mat gate run', pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 2).join(' | ') : 'clean');

    writeFileSync(join(outDir, 'material-authorship-gate.json'), JSON.stringify({
      url: MAT_URL, selfTest: self, before, afterApply, results,
    }, null, 2) + '\n');
    await page.screenshot({ path: join(outDir, 'mat-gate-final-frame.png') }).catch(() => {});
    await browser.close();
  } catch (e) {
    check('mat.fatal', 'mat gate fatal error', false, e?.message ?? String(e));
    try { await browser.close(); } catch { /* ignore */ }
  }
  finish();
}

// ── PRIM-P3 FLUID MODE (spec §0 / INV-0.5) ──────────────────────────────────────
// Drives /fluid-lab and proves the Node Law for the Fluid System review surface:
// the authorship probe + self-test are live; every instantiated fluid (surface or
// volume) maps to a backing node; editing a fluid param and triggering the
// liquid-glass timeline never orphans a render and leaves no node unrealized.
async function mainFluid() {
  if (!(await waitForServer(URL))) {
    check('server.up', `dev server reachable at ${URL}`, false, 'no 200 in 30s — start `npm run dev` first');
    finish();
    return;
  }
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  try {
    await page.goto(FLUID_URL, { waitUntil: 'domcontentloaded' });
    const booted = await page.waitForFunction(() => {
      const w = window;
      return typeof w.__PRISM_FLUID_AUTHORSHIP__ === 'function'
        && typeof w.__PRISM_FLUID_STORE__ === 'function'
        && w.__PRISM_FLUID_STORE__().schemas.length > 0;
    }, { timeout: 60000 }).then(() => true).catch(() => false);
    check('fluid.probe.installed', 'window.__PRISM_FLUID_AUTHORSHIP__ installed + fluid nodes seeded', booted,
      booted ? '' : 'probe never appeared (route did not boot)');
    if (!booted) { await browser.close(); finish(); return; }
    await page.waitForTimeout(3000);

    // 1) classifier self-test — a synthetic unbacked render MUST be caught.
    const self = await page.evaluate(() => window.__PRISM_FLUID_AUTHORSHIP_SELFTEST__?.() ?? null);
    check('fluid.classifier-live', 'authorship classifier discriminates backed vs orphan (self-test)', !!self?.live,
      self?.live ? 'synthetic orphan + untagged render both flagged — a real orphan WOULD be caught'
                 : `self-test failed: ${JSON.stringify(self)}`);

    // 2) instantiation CREATES a node in the same action (Node Law).
    const inst = await page.evaluate(async () => {
      const st = window.__PRISM_FLUID_STORE__();
      const before = st.nodes().length;
      st.instantiate('surface');
      const after = window.__PRISM_FLUID_STORE__().nodes().length;
      return { before, after };
    });
    check('fluid.instantiate-creates-node', 'instantiating a fluid auto-creates a backing node', inst.after === inst.before + 1,
      `nodes ${inst.before} → ${inst.after}`);
    await page.waitForTimeout(1500);

    // 3) CANVAS view — zero orphans, every fluid node realized.
    await page.evaluate(() => window.__PRISM_FLUID_STORE__().setView('canvas'));
    await page.waitForTimeout(1500);
    const canvas = await page.evaluate(() => window.__PRISM_FLUID_AUTHORSHIP__());
    check('fluid.canvas.no-orphan', 'CANVAS: every rendered fluid maps to a backing node (Law 0)', canvas.orphans.length === 0,
      canvas.orphans.length ? `ORPHANS: ${JSON.stringify(canvas.orphans)}` : `${canvas.renderedCount} rendered, all node-backed`);
    check('fluid.canvas.all-realized', 'CANVAS: every fluid node is realized (no node left unbuilt)', canvas.unrealized.length === 0,
      canvas.unrealized.length ? `unrealized: ${canvas.unrealized.join(', ')}` : `${canvas.nodeIds.length} nodes all realized`);

    // 4) editing a param + triggering liquid glass must not orphan anything.
    await page.evaluate(() => {
      const st = window.__PRISM_FLUID_STORE__();
      const id = st.schemas[0]?.nodeId;
      if (id) st.updateParam(id, { thickness: 2.2, viscosity: 0.3 });
      st.triggerLiquidGlass();
    });
    await page.waitForTimeout(900);
    const afterEdit = await page.evaluate(() => window.__PRISM_FLUID_AUTHORSHIP__());
    check('fluid.edit.no-orphan', 'editing params + triggering liquid glass never orphans a render', afterEdit.ok,
      afterEdit.ok ? `${afterEdit.renderedCount} rendered, all node-backed` : `FAIL: ${JSON.stringify(afterEdit.orphans)}`);

    check('fluid.no-pageerrors', 'no uncaught page errors during the fluid gate run', pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 2).join(' | ') : 'clean');

    writeFileSync(join(outDir, 'fluid-authorship-gate.json'), JSON.stringify({
      url: FLUID_URL, selfTest: self, instantiate: inst, canvas, afterEdit, results,
    }, null, 2) + '\n');
    await page.screenshot({ path: join(outDir, 'fluid-gate-final-frame.png') }).catch(() => {});
    await browser.close();
  } catch (e) {
    check('fluid.fatal', 'fluid gate fatal error', false, e?.message ?? String(e));
    try { await browser.close(); } catch { /* ignore */ }
  }
  finish();
}

function finish() {
  // FAIL conditions: a FAIL result that is not a soft WARN.
  const hardFails = results.filter((r) => !r.pass && !r.warn);
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${hardFails.length === 0 ? GREEN : RED}${passed}/${results.length} checks ok · ${hardFails.length} hard-fail${RESET}`);
  console.log(`${DIM}report → notes/verification/fix1/node-authorship-gate.json${RESET}`);
  process.exit(hardFails.length === 0 ? 0 : 1);
}

(FLUID ? mainFluid() : MAT ? mainMat() : LAB ? mainLab() : main()).catch((e) => { console.error(e); process.exit(1); });

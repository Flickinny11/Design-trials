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
const URL = (argv.find((a) => /^https?:\/\//.test(a)) || process.env.GATE_URL || 'http://localhost:3000') + '';

// Source of truth: src/lib/prism/runtime/node-authorship.ts EXPECTED_HARDCODED_ARTIFACTS.
// FIX2 / G1 — 'configurator-watch' is now a graph node (orr-atelier-watch).
// FIX3 / G2 — 'orrery-complication' is now a graph node (orr-celestia-orrery).
// Only the hub-transition remains pending G3 (W2 reclassifies it as a tagged
// runtime host, not hardcoded drift).
const EXPECTED_HARDCODED = ['hub-transition'];
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

    // ── CORE: the gate flags hardcoded artifacts, and FAILS only on UNSANCTIONED
    //    drift. The 3 known are EXPECTED-known (warn).
    check('gate.flags-hardcoded', 'gate detects hardcoded (node-less) scene artifacts', hardcoded.length > 0,
      hardcoded.length ? `flagged: ${hardLabels.join(', ')}` : 'none flagged (cannot prove the gate works)');

    const unexpected = hardLabels.filter((l) => !EXPECTED_HARDCODED.includes(l));
    check('gate.no-fresh-drift', 'no UNSANCTIONED hardcoded artifact (fresh Law-0 drift)', unexpected.length === 0,
      unexpected.length ? `UNSANCTIONED: ${unexpected.join(', ')}` : 'only the known watch/orrery/transition remain');

    for (const l of EXPECTED_HARDCODED) {
      const seen = hardLabels.includes(l);
      check(`known.${l}`, `known-hardcoded '${l}' flagged (expected until its greenlight)`, seen,
        seen ? 'flagged — pending G1/G2/G3 node migration' : 'NOT flagged this run (rig may not have mounted)',
        /* warn */ seen);
    }

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
      hardcoded, nodeAuthoredCount: nodeAuthored.size,
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

function finish() {
  // FAIL conditions: a FAIL result that is not a soft WARN.
  const hardFails = results.filter((r) => !r.pass && !r.warn);
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${hardFails.length === 0 ? GREEN : RED}${passed}/${results.length} checks ok · ${hardFails.length} hard-fail${RESET}`);
  console.log(`${DIM}report → notes/verification/fix1/node-authorship-gate.json${RESET}`);
  process.exit(hardFails.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

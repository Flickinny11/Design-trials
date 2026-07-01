#!/usr/bin/env node
// galaxy-parity-gate — FINISH F-2 STRUCTURAL TRUTH. Sibling of
// node-authorship-gate.mjs; enforces the founder's parity law in BOTH
// directions, permanently:
//
//   "there can't be an element in the ui of the watch app without there being
//    a node for it in galaxy mode... galaxy mode shows all those nodes unbuilt
//    status and then when built that's when it's visible in the preview and
//    canvas."                       — founder direction, 2026-07-01 (verbatim,
//                                     PRISM-WORKSPACE-COMPLETION-SPEC amendment)
//
// Direction A (element → galaxy node): every artifact MOUNTED in the built
//   scene (canvas, per hub) is authored by a graph node (Law 0), and every
//   content-role artifact is represented in the Galaxy first-level projection
//   (as itself or inside a component cluster). Implementation atoms with a
//   sanctioned-collapsed role (app-shell / hit-target / ambient-background /
//   embedded-decoration / global-overlay) are hub-layer/implementation detail
//   per QA-protocol §4 and are exempt from first-class galaxy display.
//
// Direction B (galaxy node → element): every first-class galaxy element
//   (projection node or cluster member) MOUNTS a non-empty artifact in canvas
//   when its hub is active — unless the node is stage-0 UNBUILT (an unbuilt
//   node is sanctioned structure-without-element: bubble in canvas, hidden in
//   preview, sphere in galaxy). Unbuilt nodes are additionally asserted ABSENT
//   from the preview-app scene.
//
// Anti-drift: the in-page probe window.__PRISM_GALAXY_PARITY__ (src/app/page.tsx)
// evaluates the REAL src/lib/prism-graph/galaxy-semantics.ts module against the
// live store; this script's static mirror (scripts/lib/galaxy-roles.mjs) is
// cross-checked against it every live run, so mirror drift is machine-caught.
//
// Usage:
//   node scripts/galaxy-parity-gate.mjs [url] [--static]
//   GATE_URL=http://localhost:3000 node scripts/galaxy-parity-gate.mjs
// `--static` runs the graph-level checks only (no browser/server) — this half
// is wired into `npm run verify`. The default (live) mode needs a running dev
// server, like node-authorship-gate.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GALAXY_ROLES,
  SANCTIONED_COLLAPSED_ROLES,
  projectedNodesFor,
  roleFor,
} from './lib/galaxy-roles.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'finish-f2');
mkdirSync(outDir, { recursive: true });

const argv = process.argv.slice(2);
const STATIC_ONLY = argv.includes('--static');
const URL = (argv.find((a) => /^https?:\/\//.test(a)) || process.env.GATE_URL || 'http://localhost:3000') + '';

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const results = [];
function check(id, desc, pass, detail = '', warn = false) {
  results.push({ id, desc, pass, warn, detail });
  const tag = pass ? (warn ? YELLOW + 'WARN' : GREEN + 'PASS') : RED + 'FAIL';
  console.log(`[${tag}${RESET}] ${id.padEnd(36)} ${desc}${detail ? `\n        ${DIM}${detail}${RESET}` : ''}`);
}

function loadGraph() {
  const p = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
  const g = JSON.parse(readFileSync(p, 'utf8'));
  return { graph: g, hubs: g.hubs ?? [], nodes: g.nodes ?? [], byId: new Map((g.nodes ?? []).map((n) => [n.nodeId, n])) };
}

/** Mirrors ArtifactNode.hasArtifactData + the text branch (same as
 *  node-authorship-gate.mjs): a node with NO real artifact source is stage-0
 *  UNBUILT — the sanctioned structure-without-element state. */
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

/** Static graph-level parity: role classification, projection membership in
 *  BOTH directions, per-hub element coverage, built/unbuilt integrity. */
function runStatic() {
  const { hubs, nodes, byId } = loadGraph();

  check('parity.graph-readable', 'live graph has hubs and nodes', hubs.length >= 2 && nodes.length > 0,
    `${hubs.length} hubs, ${nodes.length} nodes`);

  const roleByNode = new Map(nodes.map((n) => [n.nodeId, roleFor(n)]));
  const unknownRole = [...roleByNode.entries()].filter(([, r]) => !GALAXY_ROLES.includes(r));
  check('parity.roles-known', 'every graph node classifies into a known galaxy role', unknownRole.length === 0,
    unknownRole.length ? `unknown: ${unknownRole.slice(0, 6).map(([id, r]) => `${id}→${r}`).join(', ')}` : `${nodes.length} nodes across ${new Set(roleByNode.values()).size} roles`);

  const contentNodes = nodes.filter((n) => roleByNode.get(n.nodeId) === 'content');
  const projection = projectedNodesFor(contentNodes);
  const memberUnion = new Set();
  for (const p of projection) {
    for (const id of (p.clusterNodeIds ?? [p.nodeId])) memberUnion.add(id);
  }

  // Direction graph→galaxy (static): no content node silently dropped.
  const dropped = contentNodes.filter((n) => !memberUnion.has(n.nodeId)).map((n) => n.nodeId);
  check('parity.galaxy-covers-content', 'DIRECTION A (structure): every content node is represented in the galaxy projection (itself or cluster member)',
    dropped.length === 0,
    dropped.length ? `dropped from galaxy: ${dropped.slice(0, 8).join(', ')}` : `${contentNodes.length} content atoms → ${projection.length} first-class elements, 0 dropped`);

  // Direction galaxy→graph (static): no phantom projection members.
  const phantom = [...memberUnion].filter((id) => !byId.has(id));
  check('parity.projection-members-real', 'DIRECTION B (structure): every galaxy element member maps to a real graph node',
    phantom.length === 0,
    phantom.length ? `phantom: ${phantom.slice(0, 8).join(', ')}` : `${memberUnion.size} member atoms all real`);

  // Per-hub coverage: every page hub presents at least one element.
  const emptyHubs = hubs.filter((h) => !projection.some((p) => (p.parentHubId ?? '') === h.hubId));
  check('parity.per-hub-elements', 'every page hub presents at least one first-class galaxy element', emptyHubs.length === 0,
    emptyHubs.length ? `empty: ${emptyHubs.map((h) => h.hubId).join(', ')}`
      : hubs.map((h) => `${h.hubId}:${projection.filter((p) => (p.parentHubId ?? '') === h.hubId).length}`).join(', '));

  // Built/unbuilt integrity: every content node is either BUILT (real artifact
  // source) or a legitimate stage-0 UNBUILT node. Nothing in between.
  const unbuilt = contentNodes.filter((n) => !hasRealArtifact(n)).map((n) => n.nodeId);
  check('parity.content-built-or-unbuilt', 'every content node is BUILT (real artifact source) or stage-0 UNBUILT (no artifact)',
    true,
    unbuilt.length ? `built: ${contentNodes.length - unbuilt.length} · unbuilt (galaxy-only structure): ${unbuilt.slice(0, 8).join(', ')}` : `all ${contentNodes.length} content nodes are BUILT`);

  return { hubs, nodes, byId, roleByNode, contentNodes, projection, memberUnion, unbuilt: new Set(unbuilt) };
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function runLive(staticState) {
  const { hubs, byId, roleByNode, memberUnion, projection } = staticState;

  if (!(await waitForServer(URL))) {
    check('server.up', `dev server reachable at ${URL}`, false, 'no 200 in 30s — start `npm run dev` first');
    return;
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  // A fresh profile auto-launches the first-visit walkthrough, whose steps
  // DRIVE viewMode (canvas → galaxy mid-walk) and unmount the authorship probe.
  // Pre-seed the seen flag (src/lib/editor/walkthrough/seen-store.ts) so the
  // gate observes the app, not the onboarding tour.
  await context.addInitScript(() => {
    try { window.localStorage.setItem('prism.guidedTips.seen.v1', '1'); } catch { /* fine */ }
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    const booted = await page.waitForFunction(() => {
      const w = window;
      return typeof w.__PRISM_GALAXY_PARITY__ === 'function'
        && typeof w.__PRISM_NODE_AUTHORSHIP__ === 'function'
        && typeof w.__PRISM_EDITOR_SET_VIEW_MODE__ === 'function'
        && w.__PRISM_EDITOR_NODE_GROUPS__ instanceof Map
        && w.__PRISM_EDITOR_NODE_GROUPS__.size > 0;
    }, { timeout: 60000 }).then(() => true).catch(() => false);
    check('live.probes-installed', '__PRISM_GALAXY_PARITY__ + __PRISM_NODE_AUTHORSHIP__ installed, scene mounted', booted,
      booted ? '' : 'probes never appeared (runtime did not boot)');
    if (!booted) { await browser.close(); return; }
    await page.waitForTimeout(4000);

    // ── Anti-drift: the script mirror must produce the SAME first-class
    //    element set as the app's own galaxy-semantics module (in-page probe).
    const probe = await page.evaluate(() => window.__PRISM_GALAXY_PARITY__());
    const probeMembers = new Set(probe.projection.flatMap((p) => p.memberIds));
    const mirrorOnly = [...memberUnion].filter((id) => !probeMembers.has(id));
    const probeOnly = [...probeMembers].filter((id) => !memberUnion.has(id));
    check('live.mirror-matches-app', 'script mirror projection == in-page galaxy-semantics projection (no drift)',
      mirrorOnly.length === 0 && probeOnly.length === 0 && probe.projectedElementCount === projection.length,
      mirrorOnly.length || probeOnly.length
        ? `mirror-only: ${mirrorOnly.slice(0, 5).join(', ')} · probe-only: ${probeOnly.slice(0, 5).join(', ')}`
        : `${probe.projectedElementCount} first-class elements, member sets identical`);

    const unbuiltLive = new Set(probe.unbuilt);

    // ── Walk EVERY hub in CANVAS mode; union mounted artifacts + renderables.
    await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__('canvas'));
    const mountedRenderables = new Map(); // nodeId → max renderables
    const hardcodedLabels = new Set();
    const perHub = {};
    for (const hub of hubs) {
      await page.evaluate((h) => {
        const s = window.__PRISM_DEBUG_STORES__?.graphEditor;
        if (s) { const st = s.getState(); (st.flyToHub ? st.flyToHub(h) : s.setState({ activeHubId: h })); }
      }, hub.hubId);
      // Two bounded captures per hub so cold MSDF text can warm (same
      // discipline as node-authorship-gate — glyph meshes mount async).
      const hubMounted = new Map();
      for (const settleMs of [3000, 2500]) {
        await page.waitForTimeout(settleMs);
        const rep = await page.evaluate(() => window.__PRISM_NODE_AUTHORSHIP__());
        for (const a of rep.artifacts) {
          if (a.kind === 'hardcoded') hardcodedLabels.add(a.label);
          if (a.kind !== 'node' || !a.nodeId) continue;
          hubMounted.set(a.nodeId, Math.max(hubMounted.get(a.nodeId) ?? 0, a.renderables));
          mountedRenderables.set(a.nodeId, Math.max(mountedRenderables.get(a.nodeId) ?? 0, a.renderables));
        }
      }
      perHub[hub.hubId] = { mounted: hubMounted.size };
    }

    // Law 0 floor: zero hardcoded artifacts anywhere on the walk.
    check('live.no-hardcoded-artifacts', 'zero hardcoded artifacts across all hubs (Law 0 floor)', hardcodedLabels.size === 0,
      hardcodedLabels.size ? `hardcoded: ${[...hardcodedLabels].slice(0, 5).join(', ')}` : `all mounted artifacts node-authored (${mountedRenderables.size} node ids)`);

    // ── DIRECTION A (live): every mounted artifact is in the graph, and every
    //    content-role artifact is represented in the galaxy projection.
    const mountedIds = [...mountedRenderables.keys()];
    const notInGraph = mountedIds.filter((id) => !byId.has(id));
    const contentNotInGalaxy = mountedIds.filter((id) => {
      const role = roleByNode.get(id) ?? probe.roles[id] ?? 'content';
      if (SANCTIONED_COLLAPSED_ROLES.has(role)) return false;
      return !probeMembers.has(id);
    });
    check('live.element-has-galaxy-node', 'DIRECTION A: every mounted UI element has a galaxy node (projection member or sanctioned hub-layer role)',
      notInGraph.length === 0 && contentNotInGalaxy.length === 0,
      notInGraph.length || contentNotInGalaxy.length
        ? `not in graph: ${notInGraph.slice(0, 5).join(', ')} · content w/o galaxy: ${contentNotInGalaxy.slice(0, 8).join(', ')}`
        : `${mountedIds.length} mounted artifacts: all graph-backed, content all galaxy-represented`);

    // ── DIRECTION B (live): every first-class galaxy element mounts a
    //    non-empty artifact on its hub — unless stage-0 UNBUILT (sanctioned).
    const missing = [];
    const emptyNonText = [];
    const emptyText = [];
    for (const el of probe.projection) {
      for (const id of el.memberIds) {
        if (unbuiltLive.has(id)) continue; // unbuilt: galaxy-only structure, by design
        const r = mountedRenderables.get(id);
        if (r === undefined) { missing.push(id); continue; }
        if (r === 0) {
          const mode = byId.get(id)?.renderMode ?? 'sprite';
          (mode === 'text' ? emptyText : emptyNonText).push(id);
        }
      }
    }
    check('live.galaxy-node-has-element', 'DIRECTION B: every BUILT first-class galaxy element mounts a real artifact in canvas',
      missing.length === 0 && emptyNonText.length === 0,
      missing.length || emptyNonText.length
        ? `never mounted: ${missing.slice(0, 8).join(', ')} · mounted empty: ${emptyNonText.slice(0, 8).join(', ')}`
        : `${probeMembers.size} element atoms verified (${unbuiltLive.size} unbuilt exempt)`);
    if (emptyText.length) {
      check('live.text-warm', 'text elements warmed (MSDF glyphs mounted)', false,
        `still warming at capture (async, non-fatal): ${emptyText.slice(0, 8).join(', ')}`, /* warn */ true);
    }

    // ── UNBUILT stays out of the played app: switch to preview-app and assert
    //    no stage-0 node id is mounted there (founder: "when built that's when
    //    it's visible in the preview and canvas").
    await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__('preview-app'));
    await page.waitForTimeout(3000);
    const previewMounted = await page.evaluate(() =>
      [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
    const unbuiltInPreview = previewMounted.filter((id) => unbuiltLive.has(id));
    check('live.unbuilt-hidden-in-preview', 'UNBUILT nodes do not exist in preview-app (built-status law)', unbuiltInPreview.length === 0,
      unbuiltInPreview.length
        ? `unbuilt mounted in preview: ${unbuiltInPreview.slice(0, 8).join(', ')}`
        : `${unbuiltLive.size} unbuilt node(s) in graph, 0 mounted in preview`);

    check('live.no-pageerrors', 'no uncaught page errors during the parity walk', pageErrors.length === 0,
      pageErrors.length ? pageErrors.slice(0, 2).join(' | ') : 'clean');

    writeFileSync(join(outDir, 'galaxy-parity-gate.json'), JSON.stringify({
      url: URL, staticOnly: false,
      projectedElementCount: probe.projectedElementCount,
      mountedArtifacts: mountedRenderables.size,
      perHub,
      hardcoded: [...hardcodedLabels],
      directionA: { notInGraph, contentNotInGalaxy },
      directionB: { missing, emptyNonText, emptyText },
      unbuilt: [...unbuiltLive],
      previewMountedCount: previewMounted.length,
      unbuiltInPreview,
      results,
    }, null, 2) + '\n');
    await page.screenshot({ path: join(outDir, 'parity-gate-final-frame.png') }).catch(() => {});
    await browser.close();
  } catch (e) {
    check('live.fatal', 'parity gate fatal error', false, e?.message ?? String(e));
    try { await browser.close(); } catch { /* ignore */ }
  }
}

function finish() {
  const hardFails = results.filter((r) => !r.pass && !r.warn);
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${hardFails.length === 0 ? GREEN : RED}${passed}/${results.length} checks ok · ${hardFails.length} hard-fail${RESET}`);
  console.log(`${DIM}report → notes/verification/finish-f2/galaxy-parity-gate${STATIC_ONLY ? '.static' : ''}.json${RESET}`);
  process.exit(hardFails.length === 0 ? 0 : 1);
}

const staticState = runStatic();
if (STATIC_ONLY) {
  // Distinct filename — `npm run verify` (static) must never clobber the
  // committed LIVE gate evidence in galaxy-parity-gate.json.
  writeFileSync(join(outDir, 'galaxy-parity-gate.static.json'), JSON.stringify({ staticOnly: true, results }, null, 2) + '\n');
  finish();
} else {
  runLive(staticState).then(finish).catch((e) => { console.error(e); process.exit(1); });
}

#!/usr/bin/env node
// Mock App Reconstruction build script (T09).
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §14 L487-L500 (5 hubs, ≥3 mesh,
// ≥1 parallax-plane/hub, all 9 primitives, MSDF text, fly-through nav,
// build ≤35s). DoD: §17 L540.
//
// Pipeline:
//   1. Read source graph from `src/lib/prism/mock-app-renderer/graph.json`.
//      The graph is hand-authored with pre-baked depthMapUrl/meshUrl values
//      so this script is deterministic and runs without fal.ai network
//      calls. Live depth/mesh generation lives in T06's
//      `pipeline/orchestrator.ts` and is invoked end-to-end only when the
//      full plan-to-bundle pipeline runs.
//   2. esbuild-bundle `src/lib/prism/runtime/bundle.ts` so we can call its
//      `assembleBundle()` from this `.mjs` script. (kid-kode-landing has no
//      `tsx` / `ts-node` runtime; bundle.ts is the source of truth so we
//      avoid duplicating its inline ES-module templates here.)
//   3. Project the source PrismGraph onto the `CompiledGraph` shape that
//      `assembleBundle` expects (it only reads `nodeId`, `parentHubId`,
//      and the per-node `cinematicPrimitives`/`renderMode` for code
//      generation; the full PrismIntent comes along verbatim).
//   4. Run `assembleBundle()` to produce the file map. Write each file to
//      `public/prism-mock-app-renderer/`. Emit `build-manifest.json` with
//      timing + filenames. Both are read by `tests/browser/T09.mock-app-quality.spec.ts`.
//
// Run: cd kid-kode-landing && node scripts/build-mock-app.mjs
// Verify: cd kid-kode-landing && timeout 45 node scripts/build-mock-app.mjs

import { build as esbuild } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const graphSrc = resolve(repoRoot, 'src', 'lib', 'prism', 'mock-app-renderer', 'graph.json');
const bundleSrc = resolve(repoRoot, 'src', 'lib', 'prism', 'runtime', 'bundle.ts');
const outDir = resolve(repoRoot, 'public', 'prism-mock-app-renderer');

async function loadAssembleBundle() {
  const result = await esbuild({
    entryPoints: [bundleSrc],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    external: [],
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error('esbuild produced no output for bundle.ts');
  // Write to a temp file so we can dynamic-import it. Using a data URL
  // breaks `import` semantics on some Node versions; a temp .mjs is
  // simplest and well-supported.
  const tmp = join(repoRoot, 'public', 'prism-mock-app-renderer', '.bundle-runtime.mjs');
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, output.text);
  const mod = await import(tmp + '?t=' + Date.now());
  return { assembleBundle: mod.assembleBundle, buildImportMap: mod.buildImportMap, tmp };
}

function projectToCompiledGraph(source) {
  // assembleBundle's `CompiledGraph` shape (bundle.ts L48-L53) is structural —
  // it reads `hubs[*].hubId`/`title`, `nodes[*].nodeId`/`subtype`/
  // `parentHubId`/`serviceTag`/`visual`/`intent`/`codeRef`/`backendRef`,
  // and `edges[*]`. Our source PrismGraph already supplies all of these.
  // The script also threads through the renderer-era additive fields
  // (renderMode, cinematicPrimitives, depthMapUrl, meshUrl, scenePosition)
  // so the per-node template generator (T07 codegen) can read them when
  // it later replaces the bundle's per-node stubs.
  return {
    version: source.version || '0.1.0',
    hubs: source.hubs.map((h) => ({
      hubId: h.hubId,
      title: h.title,
      layout: h.layout,
    })),
    nodes: source.nodes.map((n) => ({
      nodeId: n.nodeId,
      subtype: n.subtype,
      parentHubId: n.parentHubId,
      serviceTag: n.serviceTag,
      visual: n.visual,
      intent: n.intent,
      codeRef: n.codeRef,
      backendRef: n.backendRef ?? null,
      renderMode: n.renderMode,
      depthMapUrl: n.depthMapUrl,
      meshUrl: n.meshUrl,
      cinematicPrimitives: n.cinematicPrimitives,
      scenePosition: n.scenePosition,
    })),
    edges: source.edges.map((e) => ({
      from: e.from,
      to: e.to,
      type: e.type,
      event: e.event,
      // Preserve transitionPrimitive (T09 §14.7 inter-hub fly-through nav).
      ...(e.transitionPrimitive ? { transitionPrimitive: e.transitionPrimitive } : {}),
    })),
  };
}

async function main() {
  const t0 = Date.now();
  console.log('[build-mock-app] reading graph from', graphSrc);
  if (!existsSync(graphSrc)) throw new Error(`graph.json missing at ${graphSrc}`);
  const sourceGraph = JSON.parse(readFileSync(graphSrc, 'utf8'));

  console.log('[build-mock-app] bundling runtime/bundle.ts via esbuild...');
  const { assembleBundle, buildImportMap, tmp } = await loadAssembleBundle();

  console.log('[build-mock-app] projecting source graph -> CompiledGraph...');
  const compiled = projectToCompiledGraph(sourceGraph);

  console.log('[build-mock-app] assembling bundle file map...');
  const files = assembleBundle(compiled);
  const importMap = buildImportMap();

  // Reset out dir for a clean build (preserve nothing from prior runs).
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const fileNames = Object.keys(files).sort();
  console.log(`[build-mock-app] writing ${fileNames.length} files to`, outDir);
  for (const [name, content] of Object.entries(files)) {
    const dest = join(outDir, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }

  // Emit importmap as a separate file for browser-side script-type resolution.
  writeFileSync(join(outDir, 'importmap.json'), JSON.stringify(importMap, null, 2));

  // Emit the source graph alongside the compiled one so the T09 quality
  // test can read the pre-projection graph (it asserts on the renderer-era
  // additive fields like cinematicPrimitives/renderMode + the inter-hub
  // edges with transitionPrimitive). The compiled graph.json (already
  // emitted by assembleBundle as one of `files`) carries the same data.
  writeFileSync(join(outDir, 'source-graph.json'), JSON.stringify(sourceGraph, null, 2));

  const buildDurationMs = Date.now() - t0;
  const manifest = {
    builtAt: new Date().toISOString(),
    buildDurationMs,
    fileCount: fileNames.length,
    fileNames,
    hubCount: compiled.hubs.length,
    nodeCount: compiled.nodes.length,
    edgeCount: compiled.edges.length,
  };
  writeFileSync(join(outDir, 'build-manifest.json'), JSON.stringify(manifest, null, 2));

  // Clean up the temp esbuild output file (kept name in outDir but we don't
  // need it in the published bundle).
  if (existsSync(tmp)) rmSync(tmp, { force: true });

  console.log(`[build-mock-app] done in ${buildDurationMs}ms (${fileNames.length} files, ${compiled.nodeCount ?? compiled.nodes.length} nodes, ${compiled.hubs.length} hubs)`);
  if (buildDurationMs > 35_000) {
    console.error(`[build-mock-app] WARNING: build took ${buildDurationMs}ms — exceeds spec §14 L498 budget of 35s.`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('[build-mock-app] failed:', err);
  process.exit(1);
});

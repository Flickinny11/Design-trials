#!/usr/bin/env node
// Build the renderer-era Prism artifact from the live graph source.

import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const liveGraphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const outPrism = join(repoRoot, 'public', 'prism-assets', 'mock-app.prism');
const atlasPath = join(repoRoot, 'public', 'prism-assets', 'atlas-0.avif');
const regionsPath = join(repoRoot, 'public', 'prism-assets', 'atlas-regions.json');
const msdfPng = join(repoRoot, 'public', 'prism-assets', 'font-inter.msdf.png');
const msdfFnt = join(repoRoot, 'public', 'prism-assets', 'font-inter.msdf.fnt');
const msdfJson = join(repoRoot, 'public', 'prism-assets', 'font-inter.msdf.json');

const PRISM_VERSION = '0.1.0';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function addBuffer(zip, entries, path, buf) {
  zip.file(path, buf);
  entries.push({ path, sha256: sha256(buf), bytes: buf.length });
}

function publicUrlToFile(url) {
  if (typeof url !== 'string' || !url.startsWith('/')) return null;
  return join(repoRoot, 'public', url.slice(1));
}

function addPublicAsset(zip, entries, url) {
  const file = publicUrlToFile(url);
  if (!file || !existsSync(file)) return;
  const archivePath = `public/${url.slice(1)}`;
  addBuffer(zip, entries, archivePath, readFileSync(file));
}

function addIfPresent(zip, entries, archivePath, filePath) {
  if (!existsSync(filePath)) return;
  addBuffer(zip, entries, archivePath, readFileSync(filePath));
}

function toCompiledGraph(source) {
  return {
    version: PRISM_VERSION,
    hubs: [source.hub],
    nodes: source.nodes,
    edges: source.edges,
  };
}

async function main() {
  if (!existsSync(liveGraphPath)) {
    console.error(`[build-live-prism] missing ${liveGraphPath}`);
    process.exit(1);
  }
  if (!existsSync(atlasPath) || !existsSync(regionsPath)) {
    console.error('[build-live-prism] atlas compatibility assets missing; run the existing asset pipeline once.');
    process.exit(1);
  }

  const source = JSON.parse(readFileSync(liveGraphPath, 'utf8'));
  const compiled = toCompiledGraph(source);
  const zip = new JSZip();
  const entries = [];

  addBuffer(zip, entries, 'graph.json', Buffer.from(JSON.stringify(compiled, null, 2) + '\n'));

  // Keep loader-compatibility assets for the bundle fallback path. The live
  // renderer reads sourceAsset/depth/mesh URLs directly from graph.json.
  addIfPresent(zip, entries, 'assets/atlas-0.avif', atlasPath);
  addIfPresent(zip, entries, 'assets/atlas-regions.json', regionsPath);
  addIfPresent(zip, entries, 'assets/font-inter.msdf.fnt', msdfFnt);
  addIfPresent(zip, entries, 'assets/font-inter.msdf.png', msdfPng);
  addIfPresent(zip, entries, 'assets/font-inter.msdf.json', msdfJson);

  addPublicAsset(zip, entries, source.hub?.layout?.mockupUrl);
  for (const node of compiled.nodes) {
    addPublicAsset(zip, entries, node.visual?.sourceAsset);
    addPublicAsset(zip, entries, node.depthMapUrl);
    addPublicAsset(zip, entries, node.meshUrl);
    if (node.codeRef) {
      const file = publicUrlToFile(node.codeRef);
      if (file && existsSync(file)) {
        addBuffer(zip, entries, `nodes/${node.codeRef.split('/').pop()}`, readFileSync(file));
      }
    }
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  const artifactHash = sha256(Buffer.from(entries.map((e) => `${e.path}:${e.sha256}`).join('\n')));
  const assetsRegistry = Object.fromEntries(
    entries
      .filter((e) => e.path.startsWith('assets/') || e.path.startsWith('public/'))
      .map((e) => [e.path, { sha256: e.sha256, size: e.bytes }]),
  );

  const builtAt = new Date().toISOString();
  const manifest = {
    prismVersion: PRISM_VERSION,
    playerVersionRequired: '>=0.1.0 <0.2.0',
    entryHub: source.hub.hubId,
    hubs: [source.hub.hubId],
    nodeCount: compiled.nodes.length,
    services: {
      main: {
        tag: 'main',
        target: 'browser-embedded',
        framework: 'prism-player',
        routesDir: 'backends/',
        nodeIds: compiled.nodes.map((n) => n.nodeId),
      },
    },
    integrations: [],
    assets: assetsRegistry,
    entries,
    artifactHash,
    createdAt: builtAt,
    generator: { engine: 'live-graph-renderer', version: '1.0' },
  };
  addBuffer(zip, entries, 'manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  zip.folder('meta').file('version.txt', PRISM_VERSION);
  zip.folder('meta').file('generator.json', JSON.stringify({
    generator: 'live-graph-renderer',
    version: '1.0',
    builtAt,
    nodeVersion: process.version,
  }, null, 2) + '\n');

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  writeFileSync(outPrism, buf);
  console.log(`[build-live-prism] wrote ${outPrism} (${buf.length} B)`);
  console.log(`[build-live-prism] nodes: ${compiled.nodes.length}, edges: ${compiled.edges.length}, hubs: ${compiled.hubs.length}`);
  console.log(`[build-live-prism] artifactHash: ${artifactHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

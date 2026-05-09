#!/usr/bin/env node
// Prism renderer migration audit.
//
// This is intentionally deterministic and fail-closed. It does not try to
// interpret the specs with an LLM; it reads the source-of-truth docs and
// enforces the renderer invariants that are mechanical enough to block on.

import JSZip from 'jszip';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const workspaceRoot = resolve(repoRoot, '..');

const errors = [];

const RENDER_MODES = new Set(['sprite', 'plane', 'parallax-plane', 'mesh']);
const PRIMITIVES = new Set([
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
]);
const TRIGGERS = new Set(['load', 'hover', 'click', 'scroll', 'inview', 'time']);
const SCENE_KEYS = ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotationZ', 'scaleX', 'scaleY', 'scaleZ'];

const PIXI_PATTERNS = [
  /\bpixi\.js\b/i,
  /\bpixi-filters\b/i,
  /@pixi\//i,
  /\bPIXI\./,
  /from\s+['"]pixi(?:\.js|-filters)?['"]/,
  /import\s+['"]pixi(?:\.js|-filters)?['"]/,
  /require\(\s*['"]pixi(?:\.js|-filters)?['"]\s*\)/,
];

const NODE_FORBIDDEN_PATTERNS = [
  { id: 'async-createNode', re: /async\s+function\s+createNode|export\s+default\s+async\s+function/ },
  { id: 'document-access', re: /(^|[^a-zA-Z_])document\.(?!createElement\b|getElementById\b)/ },
  { id: 'window-access', re: /(^|[^a-zA-Z_])window\.(?!devicePixelRatio\b)/ },
  { id: 'innerHTML', re: /\b(?:innerHTML|outerHTML)\s*=/ },
  { id: 'document-write', re: /\bdocument\.write\s*\(/ },
  { id: 'text-geometry', re: /\bTextGeometry\b/ },
  { id: 'dom-listener', re: /\.addEventListener\s*\(/ },
];

function fail(id, message) {
  errors.push({ id, message });
}

function rel(p) {
  return relative(workspaceRoot, p);
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function fileFromPublicUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('/')) return null;
  return join(repoRoot, 'public', url.slice(1));
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function scanText(label, text, patterns = PIXI_PATTERNS) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      fail('forbidden-pattern', `${label}: matched ${pattern}`);
    }
  }
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function scanFiles(dir, extensions, patterns = PIXI_PATTERNS) {
  for (const file of walk(dir)) {
    if (!extensions.some((ext) => file.endsWith(ext))) continue;
    scanText(rel(file), readText(file), patterns);
  }
}

function requireDoc(path, requiredSnippets) {
  if (!existsSync(path)) {
    fail('missing-spec-doc', `${rel(path)} is missing`);
    return;
  }
  const text = readText(path);
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      fail('spec-doc-anchor', `${rel(path)} did not contain required anchor: ${snippet}`);
    }
  }
}

function validateNodeModule(file, nodeId) {
  if (!existsSync(file)) {
    fail('missing-codeRef', `${nodeId}: codeRef target missing: ${rel(file)}`);
    return;
  }
  const text = readText(file);
  scanText(rel(file), text);
  for (const { id, re } of NODE_FORBIDDEN_PATTERNS) {
    if (re.test(text)) fail(id, `${rel(file)} violates ${id}`);
  }
  if (!/export\s+default\s+function|export\s+function\s+createNode|export\s+default\s+\(/.test(text)) {
    fail('coderef-export', `${rel(file)} does not expose a synchronous createNode/default factory`);
  }
}

function validateAssetUrl(url, owner, field) {
  if (url == null || url === '') return;
  const file = fileFromPublicUrl(url);
  if (!file) {
    fail('asset-url', `${owner}: ${field} must be a public absolute URL, got ${url}`);
    return;
  }
  if (!existsSync(file)) fail('missing-asset', `${owner}: ${field} target missing: ${rel(file)}`);
}

function validateGraph(graph, label) {
  const hub = graph.hub;
  const hubs = Array.isArray(graph.hubs) ? graph.hubs : hub ? [hub] : [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  if (!hubs.length) fail('graph-hubs', `${label}: expected at least one hub`);
  if (!nodes.length) fail('graph-nodes', `${label}: expected at least one node`);

  const hubIds = new Set(hubs.map((h) => h?.hubId).filter(Boolean));
  for (const h of hubs) {
    if (!h?.hubId) fail('hub-id', `${label}: hub missing hubId`);
    validateAssetUrl(h?.layout?.mockupUrl, `${label}:${h?.hubId ?? 'hub'}`, 'hub.layout.mockupUrl');
  }

  const nodeIds = new Set();
  for (const node of nodes) {
    const id = node?.nodeId ?? '<missing-nodeId>';
    if (!node?.nodeId) fail('node-id', `${label}: node missing nodeId`);
    if (nodeIds.has(id)) fail('duplicate-node', `${label}: duplicate nodeId ${id}`);
    nodeIds.add(id);
    if (!hubIds.has(node?.parentHubId)) fail('parent-hub', `${label}:${id}: invalid parentHubId ${node?.parentHubId}`);

    if (!RENDER_MODES.has(node?.renderMode)) {
      fail('render-mode', `${label}:${id}: invalid or missing renderMode ${node?.renderMode}`);
    }
    const sp = node?.scenePosition;
    if (!sp || typeof sp !== 'object') {
      fail('scene-position', `${label}:${id}: missing scenePosition`);
    } else {
      for (const key of SCENE_KEYS) {
        if (!isFiniteNumber(sp[key])) fail('scene-position', `${label}:${id}: scenePosition.${key} must be finite number`);
      }
    }

    const transform = node?.visual?.transform;
    if (!transform || !isFiniteNumber(transform.width) || transform.width <= 0 || !isFiniteNumber(transform.height) || transform.height <= 0) {
      fail('visual-transform', `${label}:${id}: visual.transform.width/height must be positive finite numbers`);
    }

    validateAssetUrl(node?.visual?.sourceAsset, `${label}:${id}`, 'visual.sourceAsset');
    if (node?.renderMode === 'parallax-plane') {
      if (!node.depthMapUrl) fail('depth-map', `${label}:${id}: parallax-plane requires depthMapUrl`);
      validateAssetUrl(node.depthMapUrl, `${label}:${id}`, 'depthMapUrl');
    }
    if (node?.renderMode === 'mesh') {
      if (!node.meshUrl) fail('mesh-url', `${label}:${id}: mesh requires meshUrl`);
      validateAssetUrl(node.meshUrl, `${label}:${id}`, 'meshUrl');
    }
    validateAssetUrl(node?.meshUrl, `${label}:${id}`, 'meshUrl');

    if (node?.codeRef) {
      const codeFile = fileFromPublicUrl(node.codeRef);
      if (!codeFile) fail('codeRef-url', `${label}:${id}: codeRef must be a public absolute URL, got ${node.codeRef}`);
      else validateNodeModule(codeFile, id);
    }

    const primitives = Array.isArray(node?.cinematicPrimitives) ? node.cinematicPrimitives : [];
    for (const primitive of primitives) {
      if (!PRIMITIVES.has(primitive?.name)) fail('primitive-name', `${label}:${id}: invalid primitive ${primitive?.name}`);
      if (!TRIGGERS.has(primitive?.trigger)) fail('primitive-trigger', `${label}:${id}: invalid trigger ${primitive?.trigger}`);
      if (!primitive?.params || typeof primitive.params !== 'object' || Array.isArray(primitive.params)) {
        fail('primitive-params', `${label}:${id}: primitive ${primitive?.name} missing params object`);
      }
    }
  }

  for (const edge of edges) {
    if (edge?.from && !nodeIds.has(edge.from)) fail('edge-from', `${label}: edge from unknown node ${edge.from}`);
    if (edge?.to && !nodeIds.has(edge.to)) fail('edge-to', `${label}: edge to unknown node ${edge.to}`);
  }
}

function sortedNodeIds(graph) {
  return [...(graph.nodes ?? [])].map((n) => n.nodeId).sort();
}

async function validatePrismArtifact(liveGraph) {
  const prismPath = join(repoRoot, 'public', 'prism-assets', 'mock-app.prism');
  if (!existsSync(prismPath)) {
    fail('prism-artifact', `${rel(prismPath)} is missing`);
    return;
  }
  const zip = await JSZip.loadAsync(readFileSync(prismPath));
  const graphFile = zip.file('graph.json');
  const manifestFile = zip.file('manifest.json');
  if (!graphFile) fail('prism-graph', 'mock-app.prism missing graph.json');
  if (!manifestFile) fail('prism-manifest', 'mock-app.prism missing manifest.json');

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (/home-hub\.legacy|mock-app-source/.test(path)) {
      fail('legacy-artifact-entry', `mock-app.prism contains legacy entry ${path}`);
    }
    if (/\.(?:js|mjs|cjs|json|txt|fnt|css|html|map)$/.test(path)) {
      scanText(`mock-app.prism:${path}`, await entry.async('string'));
    }
  }

  if (graphFile) {
    const graph = JSON.parse(await graphFile.async('string'));
    validateGraph(graph, 'mock-app.prism:graph.json');
    const liveIds = sortedNodeIds(liveGraph).join('\n');
    const prismIds = sortedNodeIds(graph).join('\n');
    if (liveIds !== prismIds) {
      fail('canonical-graph', 'mock-app.prism node ids do not match public/prism-mock/home/live-graph.json');
    }
    const prismHubIds = (graph.hubs ?? []).map((h) => h.hubId).sort().join('\n');
    if (prismHubIds !== liveGraph.hub.hubId) {
      fail('canonical-hub', 'mock-app.prism hubs do not match live-graph hub');
    }
  }

  if (manifestFile) {
    const manifest = JSON.parse(await manifestFile.async('string'));
    if (manifest.entryHub !== liveGraph.hub?.hubId) {
      fail('manifest-entryHub', `manifest.entryHub ${manifest.entryHub} does not match ${liveGraph.hub?.hubId}`);
    }
    if (manifest.nodeCount !== liveGraph.nodes.length) {
      fail('manifest-nodeCount', `manifest.nodeCount ${manifest.nodeCount} does not match live graph ${liveGraph.nodes.length}`);
    }
  }
}

function validatePackageFiles() {
  const packageJson = readJson(join(repoRoot, 'package.json'));
  const allDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
  };
  for (const dep of Object.keys(allDeps)) {
    if (/^(pixi\.js|pixi-filters|@pixi\/)/.test(dep)) {
      fail('package-pixi', `package.json must not declare ${dep}`);
    }
  }
  const buildPrism = packageJson.scripts?.['build:prism'] ?? '';
  if (/mock-app-source|home-hub\.legacy/.test(buildPrism)) {
    fail('build-prism-source', `build:prism must not use legacy source: ${buildPrism}`);
  }
  if (!/build-live-prism\.mjs/.test(buildPrism)) {
    fail('build-prism-source', `build:prism must call scripts/build-live-prism.mjs, got: ${buildPrism}`);
  }

  const lock = readJson(join(repoRoot, 'package-lock.json'));
  for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
    if (/node_modules\/(?:pixi\.js|pixi-filters|@pixi\/)/.test(pkgPath)) {
      fail('lockfile-pixi-package', `package-lock.json contains ${pkgPath}`);
    }
    for (const dep of Object.keys(meta?.dependencies ?? {})) {
      if (/^(pixi\.js|pixi-filters|@pixi\/)/.test(dep)) {
        fail('lockfile-pixi-dep', `package-lock.json ${pkgPath || '<root>'} depends on ${dep}`);
      }
    }
  }
}

function scanActiveSources() {
  const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  scanFiles(join(repoRoot, 'src', 'lib', 'prism', 'runtime'), sourceExts);
  scanFiles(join(repoRoot, 'src', 'components', 'prism-player'), sourceExts);
  scanFiles(join(repoRoot, 'src', 'components', 'editor'), sourceExts);
  scanFiles(join(repoRoot, 'public', 'prism-mock', 'home', 'nodes'), sourceExts);
  scanText('scripts/build-live-prism.mjs', existsSync(join(repoRoot, 'scripts', 'build-live-prism.mjs')) ? readText(join(repoRoot, 'scripts', 'build-live-prism.mjs')) : '');

  const scanBundle = process.env.PRISM_AUDIT_SCAN_BUNDLE === '1' || process.argv.includes('--bundle');
  const nextDir = join(repoRoot, '.next');
  if (scanBundle && existsSync(nextDir)) {
    for (const file of walk(nextDir)) {
      if (file.includes(`${join('.next', 'server', 'app', 'api')}`)) continue;
      if (file.endsWith('.js') || file.endsWith('.mjs')) {
        scanText(rel(file), readText(file));
      }
    }
  } else if (scanBundle) {
    fail('bundle-missing', '.next is missing; run npm run build before bundle audit');
  }
}

async function main() {
  requireDoc(join(repoRoot, 'docs', 'prism', 'PRISM-RENDERER-MIGRATION-SPEC.md'), [
    'scenePosition',
    'createNode',
    'PixiJS',
    'MSDF',
  ]);
  requireDoc(join(repoRoot, 'docs', 'prism', 'PRISM-ENGINE-SPEC-V3.md'), [
    'The graph is the app',
    'Knowledge graph IS the application',
  ]);
  requireDoc(join(repoRoot, 'docs', 'prism', 'CINEMATIC-PRIMITIVES-LIBRARY.md'), [
    'parallax-scroll',
    'kinetic-text',
  ]);
  requireDoc(join(repoRoot, 'notes', 'prism-vision-context.md'), [
    'The graph IS the app',
    'useGraphSourceStore',
  ]);

  validatePackageFiles();
  scanActiveSources();

  const liveGraphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
  const liveGraph = readJson(liveGraphPath);
  validateGraph(liveGraph, 'public/prism-mock/home/live-graph.json');
  await validatePrismArtifact(liveGraph);

  if (errors.length) {
    console.error('[prism-spec-audit] BLOCK — renderer migration drift detected');
    for (const e of errors) {
      console.error(`  - ${e.id}: ${e.message}`);
    }
    process.exit(2);
  }
  console.log('[prism-spec-audit] PASS — renderer migration invariants satisfied');
}

main().catch((err) => {
  console.error('[prism-spec-audit] BLOCK — audit crashed');
  console.error(err);
  process.exit(2);
});

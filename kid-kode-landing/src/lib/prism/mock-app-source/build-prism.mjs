#!/usr/bin/env node
// prism-mock Phase 6 — .prism artifact assembly.
//
// 1. Loads hubs/home-hub.json (source graph).
// 2. Loads public/prism-assets/atlas-regions.json (emitted by build-atlas).
// 3. Projects source graph → compiled graph.json by injecting atlas region
//    coordinates into every node's visual.region / visual.regions / visual.overlayRegions
//    / visual.frameRegions.
// 4. Packs per-node JS + backend JS + schemas + atlas + MSDF font into a single
//    .prism zip (deflate). Writes SHA256 for every entry to manifest.json and a
//    rollup artifactHash = SHA256 over sorted entry hashes.
//
// Run: npm run build:prism  (which runs build:atlas + build:msdf first).

import JSZip from "jszip";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceRoot = __dirname; // .../mock-app-source
const repoRoot = resolve(__dirname, "..", "..", "..", ".."); // kid-kode-landing
const graphPath = join(sourceRoot, "hubs", "home-hub.json");
const nodesDir = join(sourceRoot, "nodes");
const backendsDir = join(sourceRoot, "backends");
const schemasDir = join(sourceRoot, "schemas");
const atlasPath = join(repoRoot, "public", "prism-assets", "atlas-0.avif");
const regionsPath = join(
  repoRoot,
  "public",
  "prism-assets",
  "atlas-regions.json",
);
const msdfPng = join(repoRoot, "public", "prism-assets", "font-inter.msdf.png");
const msdfFnt = join(repoRoot, "public", "prism-assets", "font-inter.msdf.fnt");
const msdfJson = join(
  repoRoot,
  "public",
  "prism-assets",
  "font-inter.msdf.json",
);
const outPrism = join(repoRoot, "public", "prism-assets", "mock-app.prism");

const PRISM_VERSION = "0.1.0";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function buildCompiledGraph(source, regionsWrapper) {
  const regions = regionsWrapper.regions;
  const nodes = source.nodes.map((n) => {
    const asset = n.visual.sourceAsset ?? n.nodeId;
    const compiled = { ...n, visual: { ...n.visual, atlasId: "atlas-0" } };

    // Base region: nodes/base/{asset}.png → regions[asset]
    if (!n.visual.regionKeys && regions[asset]) {
      compiled.visual.region = pickRegion(regions[asset]);
    }

    // Per-state regions: notifications-toggle-{off,on} etc.
    // State PNGs live in source-images/states/ and are packed under basename
    // keys (e.g. "notifications-toggle-off"), so strip any "cropped/" prefix
    // and ".png" suffix from the asset path before forming the state key.
    if (n.visual.regionKeys) {
      const assetBase = asset.replace(/^cropped\//, "").replace(/\.png$/, "");
      compiled.visual.regions = {};
      for (const k of n.visual.regionKeys) {
        const stateKey = `${assetBase}-${k}`;
        if (regions[stateKey])
          compiled.visual.regions[k] = pickRegion(regions[stateKey]);
      }
    }

    // Overlay regions (shared): glow-pulse, shimmer, etc.
    if (n.visual.overlayRegions) {
      compiled.visual.overlayRegions = {};
      for (const ov of n.visual.overlayRegions) {
        if (regions[ov])
          compiled.visual.overlayRegions[ov] = pickRegion(regions[ov]);
      }
    }

    // Frame regions for i2v: frames/{nodeId}/frame-NNN
    if (n.visual.frameCount) {
      const frames = [];
      for (let i = 1; i <= n.visual.frameCount; i++) {
        const key = `${n.nodeId}/frame-${String(i).padStart(3, "0")}`;
        if (regions[key]) frames.push(pickRegion(regions[key]));
      }
      compiled.visual.frameRegions = frames;
    }

    return compiled;
  });

  return {
    version: PRISM_VERSION,
    hubs: [source.hub],
    nodes,
    edges: source.edges,
  };
}

function pickRegion(r) {
  return { atlasId: r.atlasId, x: r.x, y: r.y, w: r.w, h: r.h };
}

function addDirIfPresent(zip, dir, prefix) {
  if (!existsSync(dir)) return [];
  const added = [];
  const files = readdirSync(dir)
    .filter((f) => /\.(m?js|ts|json)$/.test(f))
    .sort();
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    zip.folder(prefix).file(f, buf);
    added.push({
      path: `${prefix}/${f}`,
      sha256: sha256(buf),
      bytes: buf.length,
    });
  }
  return added;
}

async function main() {
  if (!existsSync(atlasPath)) {
    console.error(
      "[build-prism] atlas not found. Run `npm run build:atlas` first.",
    );
    process.exit(1);
  }
  if (!existsSync(regionsPath)) {
    console.error("[build-prism] atlas-regions.json missing.");
    process.exit(1);
  }

  const source = JSON.parse(readFileSync(graphPath, "utf-8"));
  const regionsWrapper = JSON.parse(readFileSync(regionsPath, "utf-8"));
  const compiled = buildCompiledGraph(source, regionsWrapper);

  const zip = new JSZip();
  const entries = [];

  const graphBuf = Buffer.from(JSON.stringify(compiled, null, 2) + "\n");
  zip.file("graph.json", graphBuf);
  entries.push({
    path: "graph.json",
    sha256: sha256(graphBuf),
    bytes: graphBuf.length,
  });

  entries.push(...addDirIfPresent(zip, nodesDir, "nodes"));
  entries.push(...addDirIfPresent(zip, backendsDir, "backends"));
  entries.push(...addDirIfPresent(zip, schemasDir, "schemas"));

  // Assets
  const atlasBuf = readFileSync(atlasPath);
  zip.folder("assets").file("atlas-0.avif", atlasBuf);
  entries.push({
    path: "assets/atlas-0.avif",
    sha256: sha256(atlasBuf),
    bytes: atlasBuf.length,
  });

  const regionsBuf = readFileSync(regionsPath);
  zip.folder("assets").file("atlas-regions.json", regionsBuf);
  entries.push({
    path: "assets/atlas-regions.json",
    sha256: sha256(regionsBuf),
    bytes: regionsBuf.length,
  });

  if (existsSync(msdfFnt)) {
    const fntBuf = readFileSync(msdfFnt);
    const pngBuf = readFileSync(msdfPng);
    zip.folder("assets").file("font-inter.msdf.fnt", fntBuf);
    zip.folder("assets").file("font-inter.msdf.png", pngBuf);
    entries.push({
      path: "assets/font-inter.msdf.fnt",
      sha256: sha256(fntBuf),
      bytes: fntBuf.length,
    });
    entries.push({
      path: "assets/font-inter.msdf.png",
      sha256: sha256(pngBuf),
      bytes: pngBuf.length,
    });

    // §3.1 / §5.4 — the spec names MSDF metadata as `font-inter.msdf.json`.
    // build-msdf.mjs emits both the pixi-consumable .fnt (XML) and this JSON
    // copy; the .json ships for layout-contract compliance (msdf-loader.ts
    // still reads the .fnt). Hard-fail if it's missing — §10.19 demands the
    // artifact layout match §3.1 exactly.
    if (!existsSync(msdfJson)) {
      console.error(
        "[build-prism] font-inter.msdf.json missing — run `npm run build:msdf` to regenerate the spec-named metadata file. §3.1 requires it.",
      );
      process.exit(1);
    }
    const jsonBuf = readFileSync(msdfJson);
    zip.folder("assets").file("font-inter.msdf.json", jsonBuf);
    entries.push({
      path: "assets/font-inter.msdf.json",
      sha256: sha256(jsonBuf),
      bytes: jsonBuf.length,
    });
  } else {
    console.warn(
      "[build-prism] MSDF font not found — skipping. Run `npm run build:msdf` to include.",
    );
  }

  // Meta
  zip.folder("meta").file("version.txt", PRISM_VERSION);
  const generatorMeta = {
    generator: "hand-authored-mock",
    version: "1.0",
    builtAt: new Date().toISOString(),
    nodeVersion: process.version,
  };
  zip
    .folder("meta")
    .file("generator.json", JSON.stringify(generatorMeta, null, 2) + "\n");

  // Manifest (assets registry + per-entry hashes + rollup artifactHash)
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const artifactHash = sha256(
    entries.map((e) => `${e.path}:${e.sha256}`).join("\n"),
  );

  const assetsRegistry = Object.fromEntries(
    entries
      .filter((e) => e.path.startsWith("assets/"))
      .map((e) => [e.path, { sha256: e.sha256, size: e.bytes }]),
  );

  const manifest = {
    prismVersion: PRISM_VERSION,
    playerVersionRequired: ">=0.1.0 <0.2.0",
    entryHub: source.hub.hubId,
    hubs: [source.hub.hubId],
    nodeCount: compiled.nodes.length,
    services: {
      main: {
        tag: "main",
        target: "browser-embedded",
        framework: "prism-player",
        routesDir: "backends/",
        nodeIds: compiled.nodes.map((n) => n.nodeId),
      },
    },
    integrations: [],
    assets: assetsRegistry,
    entries,
    artifactHash,
    createdAt: generatorMeta.builtAt,
    generator: {
      engine: generatorMeta.generator,
      version: generatorMeta.version,
    },
  };
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  zip.file("manifest.json", manifestBuf);

  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  writeFileSync(outPrism, buf);

  console.log(
    `[build-prism] wrote ${outPrism} (${buf.length} B, ${entries.length} entries)`,
  );
  console.log(`[build-prism] artifactHash: ${artifactHash}`);
  console.log(
    `[build-prism] nodes: ${compiled.nodes.length}, edges: ${compiled.edges.length}, hubs: ${compiled.hubs.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

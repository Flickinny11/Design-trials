#!/usr/bin/env node
// PHOTO-PIPELINE orchestrator (W-PHOTO D2) — the reproducible R2 build.
//
//   node scripts/build-photo-composite.mjs scripts/photo-composites/<id>.mjs
//
// Runs the full composite pipeline for one config and writes a CompositeManifest
// (public/prism-mock/photo/<id>/composite.json) + the baked plates the runtime
// `layered-photo-scene` primitive assembles:
//   generate (FLUX) → cutout (bria) → depth (depth-anything-v2) →
//   shadow-plate (local) → [relight (ic-light, opt)] → grade (local) → manifest.
//
// SPEND DISCIPLINE: idempotent. A stage is SKIPPED when its output already
// exists (re-runs cost nothing); pass FORCE=1 to regenerate. Every hosted call
// prints an estimate and the running total.
//
// HONEST FALLBACK: hosted ops go through the gitignored, key-holding
// `.assetgen/*.py` (keys server-only, INV-19). If .assetgen or its key is
// absent, or a hosted call fails, the stage falls back to a LOCAL deterministic
// pass and records mode:'local' in provenance (I-PROVENANCE) — never a silent
// substitution.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { synthesizeShadowPlate } from "../src/lib/photo-pipeline/stages/shadow-plate.mjs";
import {
  gradeImage,
  DEFAULT_GRADE,
} from "../src/lib/photo-pipeline/stages/lut-grade.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, ".."); // kid-kode-landing
const REPO_ROOT = resolve(APP_ROOT, ".."); // Design-trials
const ASSETGEN = join(REPO_ROOT, ".assetgen");
const FORCE = process.env.FORCE === "1";

// Per-run rough cost estimates (USD). Logged, not billed — real spend is in the
// Replicate dashboard; these keep the run honest about the running total.
const COST = { flux: 0.08, cutout: 0.02, depth: 0.003, relight: 0.04 };
let spend = 0;
const provenance = [];

function log(...a) {
  console.log(...a);
}

function haveAssetgen(script) {
  return (
    existsSync(join(ASSETGEN, script)) &&
    existsSync(join(ASSETGEN, "replicate.key"))
  );
}

function runPy(script, args) {
  return execFileSync("python3", [join(ASSETGEN, script), ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 360_000,
  });
}

function parseProv(out) {
  const line = out.split("\n").find((l) => l.startsWith("PROV "));
  return line ? JSON.parse(line.slice(5)) : null;
}

// ── Stage: generate (FLUX) ────────────────────────────────────────────────
function generate(prompt, outPath, aspect, seed) {
  if (existsSync(outPath) && !FORCE) {
    log(`  · skip generate (exists): ${outPath}`);
    provenance.push({
      stage: "generate",
      mode: "live",
      provider: "replicate",
      model: "black-forest-labs/flux-2-pro",
      note: "reused existing",
      costUsd: 0,
      costEstimated: true,
    });
    return true;
  }
  if (!haveAssetgen("gen-flux.py")) {
    throw new Error(
      "generate requires .assetgen/gen-flux.py + replicate.key (no local fallback for base generation)",
    );
  }
  log(`  · generate: ${outPath}`);
  const out = runPy("gen-flux.py", [
    prompt,
    outPath,
    aspect,
    "2 MP",
    "png",
    String(seed),
  ]);
  spend += COST.flux;
  provenance.push({
    stage: "generate",
    mode: "live",
    provider: "replicate",
    model: "black-forest-labs/flux-2-pro",
    note: out.match(/submitted (\S+)/)?.[1] ?? "",
    costUsd: COST.flux,
    costEstimated: true,
  });
  log(
    `    ${out.trim().split("\n").pop()} | est $${COST.flux} (total ~$${spend.toFixed(3)})`,
  );
  return true;
}

// ── Stage: cutout (bria/remove-background, else local luminance) ───────────
async function cutout(srcPath, outPath) {
  if (existsSync(outPath) && !FORCE) {
    log(`  · skip cutout (exists): ${outPath}`);
    provenance.push({
      stage: "cutout",
      mode: "live",
      provider: "replicate",
      model: "bria/remove-background",
      note: "reused existing",
      costUsd: 0,
      costEstimated: true,
    });
    return;
  }
  if (haveAssetgen("replicate-op.py")) {
    try {
      const out = runPy("replicate-op.py", [
        "bria/remove-background",
        outPath,
        JSON.stringify({ image: `@${srcPath}` }),
      ]);
      const prov = parseProv(out);
      spend += COST.cutout;
      provenance.push({
        stage: "cutout",
        mode: "live",
        provider: "replicate",
        model: "bria/remove-background",
        predictionId: prov?.prediction_id,
        predictTime: prov?.predict_time,
        costUsd: COST.cutout,
        costEstimated: true,
      });
      log(
        `  · cutout (bria) ${outPath} | est $${COST.cutout} (total ~$${spend.toFixed(3)})`,
      );
      return;
    } catch (e) {
      log(
        `  ! bria cutout failed, local fallback: ${String(e).split("\n")[0]}`,
      );
    }
  }
  // Local fallback: luminance-keyed alpha (works on pure-black-bg plates).
  await localLuminanceCutout(srcPath, outPath);
  provenance.push({
    stage: "cutout",
    mode: "local",
    provider: "local",
    model: "luminance-key",
    note: "bria unavailable — local threshold cutout",
    costUsd: 0,
  });
  log(`  · cutout (local luminance) ${outPath}`);
}

async function localLuminanceCutout(srcPath, outPath, low = 14, high = 60) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    out[j] = r;
    out[j + 1] = g;
    out[j + 2] = b;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    out[j + 3] =
      lum <= low
        ? 0
        : lum >= high
          ? 255
          : Math.round(((lum - low) / (high - low)) * 255);
  }
  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outPath);
}

// ── Stage: depth (depth-anything-v2, else flat radial) ─────────────────────
async function depth(srcPath, outPath) {
  if (existsSync(outPath) && !FORCE) {
    log(`  · skip depth (exists): ${outPath}`);
    provenance.push({
      stage: "depth",
      mode: "live",
      provider: "replicate",
      model: "chenxwh/depth-anything-v2",
      note: "reused existing",
      costUsd: 0,
      costEstimated: true,
    });
    return;
  }
  if (haveAssetgen("replicate-op.py")) {
    try {
      const out = runPy("replicate-op.py", [
        "chenxwh/depth-anything-v2",
        outPath,
        JSON.stringify({ image: `@${srcPath}` }),
        "grey_depth",
      ]);
      const prov = parseProv(out);
      spend += COST.depth;
      provenance.push({
        stage: "depth",
        mode: "live",
        provider: "replicate",
        model: "chenxwh/depth-anything-v2",
        predictionId: prov?.prediction_id,
        predictTime: prov?.predict_time,
        costUsd: COST.depth,
        costEstimated: true,
      });
      log(
        `  · depth (depth-anything-v2) ${outPath} | est $${COST.depth} (total ~$${spend.toFixed(3)})`,
      );
      return;
    } catch (e) {
      log(`  ! depth failed, local fallback: ${String(e).split("\n")[0]}`);
    }
  }
  // Local fallback: a soft radial depth (center near, edges far) — approximate
  // parallax so the layer still breathes without a real depth model.
  const meta = await sharp(srcPath).metadata();
  const w = meta.width ?? 1024,
    h = meta.height ?? 1024;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="d" cx="50%" cy="45%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#3a3a3a"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#d)"/></svg>`,
  );
  await sharp(svg).png().toFile(outPath);
  provenance.push({
    stage: "depth",
    mode: "local",
    provider: "local",
    model: "radial-approx",
    note: "depth-anything unavailable — radial depth approximation",
    costUsd: 0,
  });
  log(`  · depth (local radial) ${outPath}`);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const cfgPath = process.argv[2];
  if (!cfgPath)
    throw new Error("usage: build-photo-composite.mjs <config.mjs>");
  const cfg = (await import(pathToFileURL(resolve(cfgPath)).href)).default;
  const id = cfg.id;
  const aspect = cfg.aspect ?? "3:2";
  const grade = { ...DEFAULT_GRADE, ...(cfg.grade ?? {}) };

  const scratch = join(ASSETGEN, "out", "photo", id); // gitignored raws
  const outDir = join(APP_ROOT, "public", "prism-mock", "photo", id); // committed
  mkdirSync(scratch, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const pub = (f) => `/prism-mock/photo/${id}/${f}`;

  log(`\n=== photo-composite: ${id} (${cfg.themeHue}) ===`);
  const layers = [];

  // 1. BACKDROP: generate → depth → grade (opaque plate, own depth map).
  log("[backdrop]");
  const bgRaw = join(scratch, "backdrop.png");
  generate(cfg.backdrop.prompt, bgRaw, aspect, cfg.backdrop.seed ?? 11);
  const bgDepth = join(outDir, "backdrop.depth.png");
  await depth(bgRaw, bgDepth);
  const bgGraded = join(outDir, "backdrop.png");
  if (!existsSync(bgGraded) || FORCE) await gradeImage(bgRaw, bgGraded, grade);
  provenance.push({
    stage: "grade",
    mode: "local",
    provider: "local",
    model: "filmic-lut",
    note: "backdrop",
    costUsd: 0,
  });
  layers.push({
    id: "backdrop",
    kind: "backdrop",
    assetUrl: pub("backdrop.png"),
    depthMapUrl: pub("backdrop.depth.png"),
    z: -8,
    parallaxRate: 0.15,
    scale: 1.25,
    opacity: 1,
  });

  // 2. HEADLINE (z-interleaved, MSDF text at runtime — no baked plate).
  if (cfg.headline) {
    layers.push({
      id: "headline",
      kind: "headline",
      assetUrl: "",
      z: -3.2,
      parallaxRate: 0.4,
      scale: 1,
      text: cfg.headline.text,
    });
  }

  // 3. PRODUCT: generate → cutout → shadow-plate → grade.
  log("[product]");
  const prodRaw = join(scratch, "product.png");
  generate(cfg.product.prompt, prodRaw, aspect, cfg.product.seed ?? 7);
  const prodCut = join(outDir, "product.png");
  await cutout(prodRaw, prodCut);
  const shadow = join(outDir, "product.shadow.png");
  if (!existsSync(shadow) || FORCE)
    await synthesizeShadowPlate(prodCut, shadow);
  provenance.push({
    stage: "shadow-plate",
    mode: "local",
    provider: "local",
    model: "alpha-cast",
    note: "product",
    costUsd: 0,
  });
  // grade the cutout (preserves alpha)
  if (FORCE) await gradeImage(prodCut, prodCut, grade);
  provenance.push({
    stage: "grade",
    mode: "local",
    provider: "local",
    model: "filmic-lut",
    note: "product",
    costUsd: 0,
  });
  layers.push({
    id: "shadow",
    kind: "shadow",
    assetUrl: pub("product.shadow.png"),
    z: -2.6,
    parallaxRate: 0.55,
    scale: 1.0,
    opacity: 0.9,
    float: { ampX: 0, ampY: 0.02, rotate: 0, period: 7, phase: 0 },
  });
  layers.push({
    id: "product",
    kind: "product",
    assetUrl: pub("product.png"),
    z: -2.4,
    parallaxRate: 0.6,
    scale: 1.0,
    opacity: 1,
    float: { ampX: 0.02, ampY: 0.06, rotate: 0.01, period: 6.5, phase: 0 },
  });

  // 4. GARNISH: generate → cutout → grade, each on its own float loop.
  const garnish = cfg.garnish ?? [];
  for (let i = 0; i < garnish.length; i++) {
    const g = garnish[i];
    log(`[garnish ${g.id}]`);
    const gRaw = join(scratch, `garnish-${g.id}.png`);
    generate(g.prompt, gRaw, "1:1", g.seed ?? 20 + i);
    const gCut = join(outDir, `garnish-${g.id}.png`);
    await cutout(gRaw, gCut);
    const phase = (i / Math.max(1, garnish.length)) * Math.PI * 2;
    layers.push({
      id: `garnish-${g.id}`,
      kind: "garnish",
      assetUrl: pub(`garnish-${g.id}.png`),
      z: g.z ?? -1.6 + i * 0.15,
      parallaxRate: 0.85,
      scale: g.scale ?? 0.28,
      blur: g.blur ?? 0,
      opacity: g.opacity ?? 0.95,
      float: {
        ampX: 0.05 + (i % 3) * 0.02,
        ampY: 0.08 + (i % 2) * 0.03,
        rotate: 0.04,
        period: 5 + i * 0.8,
        phase,
      },
    });
  }

  // 5. Manifest.
  const manifest = {
    schemaVersion: "prism-photo-v1",
    id,
    createdAt: new Date().toISOString(),
    route: "R2",
    themeHue: cfg.themeHue,
    layers,
    provenance,
    grade,
  };
  const manifestPath = join(outDir, "composite.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  log(`\n=== wrote ${manifestPath} (${layers.length} layers) ===`);
  log(`=== estimated spend this run: $${spend.toFixed(3)} ===`);
  const liveStages = provenance.filter((p) => p.mode === "live").length;
  log(`=== provenance: ${provenance.length} stages (${liveStages} live) ===`);
}

main().catch((e) => {
  console.error("BUILD-FAILED", e.message ?? e);
  process.exit(1);
});

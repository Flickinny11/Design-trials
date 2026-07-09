#!/usr/bin/env node
// W-BG D4 — generate the graded cinematic background PLATES (R2/R3 assets).
//
// For each plate spec: FLUX-2-pro original composition (Replicate, via the
// committed .assetgen client) → depth-anything-v2 full-frame depth → local
// deterministic filmic grade (sharp: saturation trim + contrast lift +
// vignette) → baked to public/three-d-bg/plates/<id>.webp + <id>-depth.webp
// (DL13: assets baked, public URLs only in graph data — INV-7).
//
// Idempotent: existing outputs are SKIPPED and their ledger entries preserved
// (prediction ids are provenance, I-PROVENANCE — never regenerate over them).
// Ledger: notes/verification/shell-wbg/plates-ledger.json (merged, not
// overwritten). Spend is estimated per call and summed.
//
// Usage: node scripts/three-d-backgrounds/gen-wbg-plates.mjs [--only <id>]

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd(); // kid-kode-landing
const ASSETGEN = path.resolve(ROOT, "..", ".assetgen");
const SCRATCH = path.join(ASSETGEN, "out", "wbg-plates");
const OUT_DIR = path.join(ROOT, "public", "three-d-bg", "plates");
const LEDGER = path.join(
  ROOT,
  "notes",
  "verification",
  "shell-wbg",
  "plates-ledger.json",
);

// Estimated unit costs (USD) — logged, not billed here.
const COST_FLUX = 0.06; // flux-2-pro ~2MP
const COST_DEPTH = 0.01; // depth-anything-v2

const NEG = "no text, no letters, no labels, no watermark, no logo, no people";

// ORIGINAL compositions (legal doctrine §2): each an authored scene brief in
// the technique vocabulary of its grammar family — never a copy of a source.
// Backdrop discipline: empty middle ground, no centered focal subject, dark-
// leaning but LIT (W-PHOTO gotcha: "deep near-black" prompts render true
// black), so app content reads on top.
const PLATES = [
  {
    id: "ridge-dusk",
    prompt: `Layered mountain ridgelines receding into evening mist at dusk, deep teal sky with a restrained ember-orange horizon glow, strong atmospheric perspective, soft haze separating each ridge, empty middle ground, cinematic color grade, fine film grain, ${NEG}`,
  },
  {
    id: "rain-bokeh",
    prompt: `Out-of-focus night city lights seen through rain-streaked glass, large soft bokeh discs in cool cyan and steel blue over a dark ground, a few small warm accents, shallow depth of field, empty center, moody cinematic still, ${NEG}`,
  },
  {
    id: "marble-atrium",
    prompt: `Vast pale marble atrium interior, tall smooth columns at the edges, soft diagonal light shafts through high clerestory windows, gentle luminous haze, generous empty center, minimal editorial architecture photography, high key but soft, ${NEG}`,
  },
  {
    id: "dune-sea",
    prompt: `Minimal desert dune field at blue hour, smooth wind-carved sand ridges in pale bone and slate tones, long soft shadows, vast quiet negative-space sky, empty middle ground, fine grain, cinematic wide shot, ${NEG}`,
  },
  {
    id: "harbor-fog",
    prompt: `Calm harbor water dissolving into dense fog at dawn, one faint distant navigation light glow, muted steel-blue palette, long-exposure silky water, low minimal horizon, large soft empty sky, cinematic, ${NEG}`,
  },
  {
    id: "canopy-light",
    prompt: `Volumetric sunbeams breaking through a dark forest canopy seen from below, deep green and near-black foliage, glowing god rays with drifting dust, dark edges and a soft bright core, moody cinematic, ${NEG}`,
  },
  {
    id: "basalt-coast",
    prompt: `Dark basalt sea stacks at the edges of a black sand coast, long-exposure silky white water, overcast dramatic sky, restrained monochrome grade with a faint warm horizon, empty center, fine-art seascape, ${NEG}`,
  },
  {
    id: "city-dusk",
    prompt: `Distant city skyline at dusk across open water, strongly defocused, cool graphite and cyan tones with scattered warm window lights, atmospheric haze, low skyline leaving a tall empty sky, cinematic wide shot, ${NEG}`,
  },
  {
    id: "polar-ridge",
    prompt: `Snow-covered mountain ridge at night under green aurora curtains, star field, cold teal and green palette, quiet vast landscape with an empty dark foreground, cinematic astrophotography, ${NEG}`,
  },
];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => {
      out += String(d);
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

function provOf(out) {
  const line = out.split("\n").find((l) => l.startsWith("PROV "));
  if (line) {
    try {
      return JSON.parse(line.slice(5));
    } catch {
      return null;
    }
  }
  const sub = out.split("\n").find((l) => l.startsWith("submitted "));
  return sub ? { prediction_id: sub.split(" ")[1] } : null;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Deterministic filmic grade: saturation trim, gentle S-curve lift, and a
 *  radial vignette so plate edges melt into the scene atmosphere. */
async function gradePlate(srcPath, outPath) {
  const W = 1920;
  const meta = await sharp(srcPath).metadata();
  const H = Math.round((W * (meta.height ?? 1080)) / (meta.width ?? 1920));
  const vignette = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="46%" r="72%"><stop offset="55%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.42"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`,
  );
  await sharp(srcPath)
    .resize(W, H)
    .modulate({ saturation: 0.88 })
    .linear(1.07, -9) // contrast lift with a slightly crushed floor
    .composite([{ input: vignette, blend: "multiply" }])
    .webp({ quality: 82 })
    .toFile(outPath);
}

async function gradeDepth(srcPath, outPath) {
  await sharp(srcPath)
    .resize(960)
    .greyscale()
    .webp({ quality: 80 })
    .toFile(outPath);
}

async function main() {
  const only = process.argv.includes("--only")
    ? process.argv[process.argv.indexOf("--only") + 1]
    : null;

  if (!(await exists(path.join(ASSETGEN, "replicate.key")))) {
    console.error(
      "MISSING .assetgen/replicate.key — cannot generate. Aborting (no fakes).",
    );
    process.exit(2);
  }
  await mkdir(SCRATCH, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.dirname(LEDGER), { recursive: true });

  let ledger = { plates: {}, totalEstUsd: 0 };
  if (await exists(LEDGER)) {
    try {
      ledger = JSON.parse(await readFile(LEDGER, "utf8"));
    } catch {
      /* fresh ledger */
    }
  }
  ledger.plates = ledger.plates || {};

  for (const plate of PLATES) {
    if (only && plate.id !== only) continue;
    const rawPlate = path.join(SCRATCH, `${plate.id}.png`);
    const rawDepth = path.join(SCRATCH, `${plate.id}-depth.png`);
    const outPlate = path.join(OUT_DIR, `${plate.id}.webp`);
    const outDepth = path.join(OUT_DIR, `${plate.id}-depth.webp`);

    if ((await exists(outPlate)) && (await exists(outDepth))) {
      console.log(`SKIP ${plate.id} (baked outputs exist; ledger preserved)`);
      continue;
    }

    const entry = ledger.plates[plate.id] || { id: plate.id, calls: [] };

    if (!(await exists(rawPlate))) {
      console.log(`\n[${plate.id}] FLUX plate…`);
      const out = await run("python3", [
        path.join(ASSETGEN, "gen-flux.py"),
        plate.prompt,
        rawPlate,
        "16:9",
        "2 MP",
        "png",
        String(101 + PLATES.indexOf(plate)),
      ]);
      entry.calls.push({
        stage: "generate",
        model: "black-forest-labs/flux-2-pro",
        prov: provOf(out),
        estUsd: COST_FLUX,
      });
    }
    if (!(await exists(rawDepth))) {
      console.log(`[${plate.id}] depth…`);
      const out = await run("python3", [
        path.join(ASSETGEN, "replicate-op.py"),
        "chenxwh/depth-anything-v2",
        rawDepth,
        JSON.stringify({ image: `@${rawPlate}` }),
        "grey_depth",
      ]);
      entry.calls.push({
        stage: "depth",
        model: "chenxwh/depth-anything-v2",
        prov: provOf(out),
        estUsd: COST_DEPTH,
      });
    }

    console.log(`[${plate.id}] grade + bake…`);
    await gradePlate(rawPlate, outPlate);
    await gradeDepth(rawDepth, outDepth);
    entry.baked = {
      plate: `/three-d-bg/plates/${plate.id}.webp`,
      depth: `/three-d-bg/plates/${plate.id}-depth.webp`,
      gradedAt: new Date().toISOString(),
    };
    ledger.plates[plate.id] = entry;
    ledger.totalEstUsd = Object.values(ledger.plates)
      .flatMap((p) => p.calls || [])
      .reduce((s, c) => s + (c.estUsd || 0), 0);
    await writeFile(LEDGER, JSON.stringify(ledger, null, 2));
    console.log(`[${plate.id}] DONE`);
  }
  console.log(
    `\nLedger: ${LEDGER} — est total $${ledger.totalEstUsd.toFixed(2)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

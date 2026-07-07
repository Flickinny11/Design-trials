#!/usr/bin/env node
// W-TPL D2 — reproducible template-asset generation (beyond the Meridian R2
// composite, which scripts/build-photo-composite.mjs owns).
//
//   node scripts/gen-wtpl-assets.mjs [set ...]     (default: all sets)
//
// Generates every single-image asset the W-TPL hub templates use, via the
// gitignored key-holding .assetgen pipelines (INV-19): FLUX 2 Pro stills,
// bria cutouts, depth-anything-v2 depth maps. IDEMPOTENT: existing outputs are
// skipped (FORCE=1 to regenerate). Every hosted call's prediction id + predict
// time is appended to public/prism-mock/templates/provenance.json
// (I-PROVENANCE), and the running spend estimate is printed.
//
// Subjects are ORIGINAL compositions per the legal doctrine (PLAN §2) — no
// analyzed-source subject is recreated. Every prompt carries the negative-text
// discipline (FP-13): FLUX must never bake letterforms into a plate.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, "..");
const ASSETGEN = resolve(APP_ROOT, "..", ".assetgen");
const OUT_ROOT = join(APP_ROOT, "public", "prism-mock", "templates");
const PROV_PATH = join(OUT_ROOT, "provenance.json");
const FORCE = process.env.FORCE === "1";

const COST = { flux: 0.08, cutout: 0.02, depth: 0.003 };
let spend = 0;

function runPy(script, args) {
  return execFileSync("python3", [join(ASSETGEN, script), ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 360_000,
  });
}

const provenance = existsSync(PROV_PATH)
  ? JSON.parse(readFileSync(PROV_PATH, "utf8"))
  : [];

function recordProv(entry) {
  provenance.push({ ...entry, at: new Date().toISOString() });
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(PROV_PATH, JSON.stringify(provenance, null, 2) + "\n");
}

function parseProv(out) {
  const line = out.split("\n").find((l) => l.startsWith("PROV "));
  return line ? JSON.parse(line.slice(5)) : null;
}

function flux(outPath, prompt, { aspect = "1:1", res = "1 MP", fmt = "webp", seed = 7 } = {}) {
  if (existsSync(outPath) && !FORCE) {
    console.log(`  · skip (exists): ${outPath}`);
    return;
  }
  mkdirSync(dirname(outPath), { recursive: true });
  const out = runPy("gen-flux.py", [prompt, outPath, aspect, res, fmt, String(seed)]);
  const sub = out.split("\n").find((l) => l.startsWith("submitted "));
  const predictionId = sub ? sub.split(" ")[1] : null;
  spend += COST.flux;
  recordProv({ stage: "generate", model: "black-forest-labs/flux-2-pro", mode: "live", predictionId, out: outPath.replace(APP_ROOT, ""), seed, prompt });
  console.log(`  · flux ${outPath} | est $${COST.flux} (total ~$${spend.toFixed(2)})`);
}

function cutout(srcPath, outPath) {
  if (existsSync(outPath) && !FORCE) {
    console.log(`  · skip cutout (exists): ${outPath}`);
    return;
  }
  const out = runPy("replicate-op.py", ["bria/remove-background", outPath, JSON.stringify({ image: `@${srcPath}` })]);
  const prov = parseProv(out);
  spend += COST.cutout;
  recordProv({ stage: "cutout", model: "bria/remove-background", mode: "live", predictionId: prov?.prediction_id, predictTime: prov?.predict_time, out: outPath.replace(APP_ROOT, "") });
  console.log(`  · cutout ${outPath} | est $${COST.cutout} (total ~$${spend.toFixed(2)})`);
}

function depth(srcPath, outPath) {
  if (existsSync(outPath) && !FORCE) {
    console.log(`  · skip depth (exists): ${outPath}`);
    return;
  }
  const out = runPy("replicate-op.py", ["chenxwh/depth-anything-v2", outPath, JSON.stringify({ image: `@${srcPath}` }), "grey_depth"]);
  const prov = parseProv(out);
  spend += COST.depth;
  recordProv({ stage: "depth", model: "chenxwh/depth-anything-v2", mode: "live", predictionId: prov?.prediction_id, predictTime: prov?.predict_time, out: outPath.replace(APP_ROOT, "") });
  console.log(`  · depth ${outPath} | est $${COST.depth} (total ~$${spend.toFixed(2)})`);
}

const p = (...seg) => join(OUT_ROOT, ...seg);
const NEG = "no text, no letters, no labels";

// ---------------------------------------------------------------------------
// The sets
// ---------------------------------------------------------------------------

const SETS = {
  // Marginalia (editorial single-plate depth hero): one cinematic landscape +
  // its depth map for the parallax-plane displacement lane.
  marginalia() {
    const plate = p("marginalia", "valley-plate.webp");
    flux(
      plate,
      `a vast mist-layered mountain valley at first light, ridgelines receding in soft blue-grey haze bands, a winding river catching pale gold dawn light, cinematic aerial photograph, strong atmospheric depth, photoreal, ${NEG}`,
      { aspect: "3:2", res: "2 MP", seed: 51 },
    );
    depth(plate, p("marginalia", "valley-plate.depth.png"));
  },

  // Lumen (infinite-filmstrip gallery): six cohesive single-hue ceramics —
  // the family's "30+ cohesive single-hue images" mechanic at template scale.
  lumen() {
    const vessels = [
      ["a tall handthrown ceramic bottle vase with a narrow neck", 61],
      ["a wide shallow handthrown ceramic bowl with an unglazed rim", 62],
      ["a round-bellied handthrown ceramic teapot without markings", 63],
      ["a stack of three small handthrown ceramic cups", 64],
      ["a sculptural handthrown ceramic vessel with a folded rim", 65],
      ["a slender handthrown ceramic pitcher with a pulled handle", 66],
    ];
    vessels.forEach(([subject, seed], i) => {
      flux(
        p("lumen", `vessel-${i + 1}.webp`),
        `${subject}, deep indigo-blue glaze with graphite speckle, on a dark charcoal studio backdrop, single soft cool key light from the left, consistent editorial product photograph, photoreal, ${NEG}`,
        { aspect: "1:1", res: "1 MP", seed },
      );
    });
  },

  // Vitrine (filmstrip product showcase): four stills of one eyewear line,
  // consistent warm-neutral grade (the unified-set-grade mechanic).
  vitrine() {
    const frames = [
      ["round tortoiseshell acetate frame glasses, folded, three-quarter view", 71],
      ["the same round tortoiseshell acetate glasses standing open, front view", 72],
      ["a macro detail of a tortoiseshell acetate glasses hinge and temple", 73],
      ["round tortoiseshell acetate glasses resting on a folded soft grey cloth", 74],
    ];
    frames.forEach(([subject, seed], i) => {
      flux(
        p("vitrine", `frame-${i + 1}.webp`),
        `${subject}, warm amber studio light on a warm dark-taupe seamless backdrop, shallow depth of field, premium eyewear campaign photograph, photoreal, ${NEG}`,
        { aspect: "4:3", res: "1 MP", seed },
      );
    });
  },

  // Chronicle (about, era plates): three warm heritage-workshop scenes.
  chronicle() {
    const eras = [
      ["a small woodworker's bench with hand planes and curled shavings, morning window light", 81],
      ["rows of chisels and calipers hung on a workshop wall, warm tungsten light", 82],
      ["hands shaping a curved wooden chair back on a workbench, sawdust in the light beam", 83],
    ];
    eras.forEach(([subject, seed], i) => {
      flux(
        p("chronicle", `era-${i + 1}.webp`),
        `${subject}, warm sepia-amber grade, honest documentary photograph, cinematic haze, photoreal, ${NEG}`,
        { aspect: "3:2", res: "1 MP", seed },
      );
    });
  },

  // Beacon (contact hover-morph sandwich): dusk sky plate + lighthouse cutout.
  beacon() {
    flux(
      p("beacon", "sky-plate.webp"),
      `a moody dusk sky over a dark sea horizon, deep indigo clouds with a warm coral afterglow band, faint stars appearing, cinematic seascape photograph, photoreal, ${NEG}`,
      { aspect: "3:2", res: "2 MP", seed: 91 },
    );
    const lh = p("beacon", "lighthouse.png");
    flux(
      lh,
      `a photoreal white-and-coral striped lighthouse on a rocky outcrop, warm lamp glow at the top, dusk light, isolated on a pure solid black background, studio composite plate, ultra sharp, ${NEG}`,
      { aspect: "2:3", res: "1 MP", fmt: "png", seed: 92 },
    );
    cutout(lh, p("beacon", "lighthouse.cut.png"));
  },

  // Cascade (parallax-zoom deep dive): far backdrop + two portal frames whose
  // open centers the cutout stage makes transparent (the zoom-through planes).
  cascade() {
    flux(
      p("cascade", "deep-backdrop.webp"),
      `looking down an endless dark colonnade toward a distant luminous amber doorway, volumetric light shafts, deep perspective, cinematic architectural photograph, photoreal, ${NEG}`,
      { aspect: "3:2", res: "2 MP", seed: 101 },
    );
    const arch1 = p("cascade", "arch-1.png");
    flux(
      arch1,
      `a photoreal weathered dark stone archway seen straight on, the opening in the center completely empty, isolated on a pure solid black background showing through the opening, dramatic amber edge light, ${NEG}`,
      { aspect: "1:1", res: "1 MP", fmt: "png", seed: 102 },
    );
    cutout(arch1, p("cascade", "arch-1.cut.png"));
    const arch2 = p("cascade", "arch-2.png");
    flux(
      arch2,
      `a photoreal brushed bronze circular portal ring seen straight on, the center completely open and empty, isolated on a pure solid black background showing through the center, cool rim light, ${NEG}`,
      { aspect: "1:1", res: "1 MP", fmt: "png", seed: 103 },
    );
    cutout(arch2, p("cascade", "arch-2.cut.png"));
  },

  // Ledgerline (pricing as an editorial product set): three tier objects under
  // ONE grade — the material tells the tier story (marble → brass → obsidian).
  ledgerline() {
    const tiers = [
      ["a small carved white carrara marble cube with soft veining", "marble", 111],
      ["a polished solid brass sphere with a single soft highlight", "brass", 112],
      ["a faceted black obsidian prism with glassy edges", "obsidian", 113],
    ];
    for (const [subject, id, seed] of tiers) {
      const src = p("ledgerline", `${id}.png`);
      flux(
        src,
        `${subject}, resting on a dark slate surface, single warm gallery spotlight from above, deep shadow, consistent editorial still-life photograph, isolated composition, photoreal, ${NEG}`,
        { aspect: "1:1", res: "1 MP", fmt: "png", seed },
      );
      cutout(src, p("ledgerline", `${id}.cut.png`));
    }
  },

  // Folio (editorial oversized-type cover): two plates the masthead interlocks
  // with.
  folio() {
    flux(
      p("folio", "cover-plate.webp"),
      `a dancer mid-leap wrapped in flowing crimson fabric against a deep charcoal studio backdrop, dramatic single side light, high-contrast editorial fashion photograph, photoreal, ${NEG}`,
      { aspect: "2:3", res: "1 MP", seed: 121 },
    );
    flux(
      p("folio", "detail-plate.webp"),
      `a macro study of crimson silk fabric folds catching a single warm light, deep shadows, abstract editorial photograph, photoreal, ${NEG}`,
      { aspect: "3:2", res: "1 MP", seed: 122 },
    );
  },

  // Tessella (marketing bento): three abstract material macros for the
  // feature tiles (the rest of the grid is asset-free PBR mesh).
  tessella() {
    const tiles = [
      ["a macro of liquid chrome rippling in slow waves", 131],
      ["a macro of deep emerald glass with internal refracted light lines", 132],
      ["a macro of dark basalt columns with a thin gold seam of light", 133],
    ];
    tiles.forEach(([subject, seed], i) => {
      flux(
        p("tessella", `tile-${i + 1}.webp`),
        `${subject}, moody studio light, premium abstract material photograph, photoreal, ${NEG}`,
        { aspect: "1:1", res: "1 MP", seed },
      );
    });
  },

  // Waypoint (contact coverflow): one embossed relief-map macro for the
  // location card.
  waypoint() {
    flux(
      p("waypoint", "relief-map.webp"),
      `a macro of an embossed brass topographic relief map, contour ridges catching warm raking light on dark patina, premium object photograph, photoreal, ${NEG}`,
      { aspect: "1:1", res: "1 MP", seed: 141 },
    );
  },
};

// ---------------------------------------------------------------------------

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(SETS);
for (const name of names) {
  const fn = SETS[name];
  if (!fn) {
    console.error(`unknown set: ${name} (have: ${Object.keys(SETS).join(", ")})`);
    process.exit(1);
  }
  console.log(`— set: ${name}`);
  fn();
}
console.log(`DONE. est spend this run: $${spend.toFixed(2)}`);

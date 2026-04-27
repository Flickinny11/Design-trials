#!/usr/bin/env node
// prism-mock Phase 5 — MSDF font atlas builder.
// Generates PixiJS-v8-compatible MSDF bitmap font from Inter-Variable.ttf using
// the pure-JS msdf-bmfont-xml generator (chosen over msdf-atlas-gen because the
// C++ binary is brittle on macOS/arm). Outputs .fnt (BMFont XML) + .png AND a
// JSON-equivalent .msdf.json (§3.1 / §5.4 artifact layout: spec names the
// metadata file as `font-inter.msdf.json`; pixi's BitmapText parser reads the
// .fnt, and the .msdf.json ships alongside to satisfy §10.19's layout contract).
//
// Run: npm run build:msdf

import generateBMFont from "msdf-bmfont-xml";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..", "..", "..");
const fontPath = join(repoRoot, "public", "fonts", "Inter-Variable.ttf");
const outDir = join(repoRoot, "public", "prism-assets");
const outPng = join(outDir, "font-inter.msdf.png");
const outFnt = join(outDir, "font-inter.msdf.fnt");
const outJson = join(outDir, "font-inter.msdf.json");

const CHARSET =
  Array.from({ length: 127 - 32 }, (_, i) => String.fromCharCode(32 + i)).join(
    "",
  ) + "—©";

const BASE_OPTIONS = {
  fieldType: "msdf",
  fontSize: 48,
  charset: CHARSET,
  textureSize: [2048, 2048],
  texturePadding: 2,
  distanceRange: 4,
  smartSize: true,
  pot: false,
  square: false,
  rot: false,
  rtl: false,
};

mkdirSync(outDir, { recursive: true });

function run(outputType) {
  return new Promise((resolvePromise, rejectPromise) => {
    generateBMFont(
      fontPath,
      { ...BASE_OPTIONS, outputType },
      (err, textures, font) => {
        if (err) return rejectPromise(err);
        resolvePromise({ textures, font });
      },
    );
  });
}

// msdf-bmfont-xml generates the packed atlas deterministically from the same
// input (font + charset + seed-free maxrects), so two invocations produce
// identical textures and identical glyph layouts. We pay for the second run
// once at build time to keep the on-disk artifact shape spec-compliant.
const [xmlOut, jsonOut] = await Promise.all([run("xml"), run("json")]);

if (xmlOut.textures.length !== 1) {
  console.warn(
    `[build-msdf] got ${xmlOut.textures.length} textures — mock expects 1. Consider raising textureSize or trimming CHARSET.`,
  );
}

// PNG atlas — same bytes regardless of metadata format.
writeFileSync(outPng, xmlOut.textures[0].texture);

// .fnt (BMFont XML) — rewrite the <page file="..."> to match the atlas filename.
const fntXml = String(xmlOut.font.data).replace(
  /file="[^"]+"/,
  `file="font-inter.msdf.png"`,
);
writeFileSync(outFnt, fntXml);

// .msdf.json (BMFont JSON) — rewrite the single `pages` entry to point at the
// atlas filename. The generator emits [ "<basename>_<i>" ] without an extension,
// so we normalise it to the deterministic `font-inter.msdf.png` name, matching
// the .fnt's <page file=""> and the manifest's assets registry.
const jsonData = JSON.parse(String(jsonOut.font.data));
if (Array.isArray(jsonData.pages)) {
  jsonData.pages = jsonData.pages.map(() => "font-inter.msdf.png");
}
writeFileSync(outJson, JSON.stringify(jsonData, null, 2) + "\n");

console.log(`[build-msdf] wrote ${outPng}`);
console.log(`[build-msdf] wrote ${outFnt}`);
console.log(`[build-msdf] wrote ${outJson}`);

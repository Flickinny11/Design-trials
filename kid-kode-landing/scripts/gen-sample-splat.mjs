#!/usr/bin/env node
// Generate a sample gaussian-splat .ply (W-PHOTO D5) so the R4 viewer's file
// LOADER path is exercised with a real asset (capture generation is a later
// wave). Writes a colourful torus of ~4000 gaussians in the standard INRIA 3DGS
// .ply layout (binary_little_endian) that Spark's PlyReader consumes.
//
//   node scripts/gen-sample-splat.mjs
//   → public/prism-mock/splat/sample-torus.ply

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SH_C0 = 0.28209479177387814; // SH band-0 coefficient
const logit = (a) => Math.log(a / (1 - a));
const enc = (c) => (c - 0.5) / SH_C0; // colour → f_dc

const N = 4000;
const R = 1.0; // torus major radius
const r = 0.42; // torus minor radius
const props = [
  "x",
  "y",
  "z",
  "f_dc_0",
  "f_dc_1",
  "f_dc_2",
  "opacity",
  "scale_0",
  "scale_1",
  "scale_2",
  "rot_0",
  "rot_1",
  "rot_2",
  "rot_3",
];

const header =
  `ply\nformat binary_little_endian 1.0\nelement vertex ${N}\n` +
  props.map((p) => `property float ${p}`).join("\n") +
  `\nend_header\n`;

const buf = Buffer.alloc(N * props.length * 4);
let o = 0;
const f = (v) => {
  buf.writeFloatLE(v, o);
  o += 4;
};

// deterministic PRNG so the asset is byte-stable
let s = 20260706;
const rand = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
};

const lnScale = Math.log(0.026);
for (let i = 0; i < N; i++) {
  const u = rand() * Math.PI * 2; // around the tube
  const v = (i / N) * Math.PI * 2; // around the ring
  const x = (R + r * Math.cos(u)) * Math.cos(v);
  const y = r * Math.sin(u);
  const z = (R + r * Math.cos(u)) * Math.sin(v);
  f(x);
  f(y);
  f(z);
  // hue sweeps around the ring (warm gold → teal) for a lively captured look
  const t = v / (Math.PI * 2);
  const cr = 0.55 + 0.4 * Math.cos(t * 6.283);
  const cg = 0.5 + 0.35 * Math.cos(t * 6.283 + 2.1);
  const cb = 0.55 + 0.4 * Math.cos(t * 6.283 + 4.2);
  f(enc(cr));
  f(enc(cg));
  f(enc(cb));
  f(logit(0.92)); // opacity
  f(lnScale);
  f(lnScale);
  f(lnScale); // isotropic small gaussians
  f(1);
  f(0);
  f(0);
  f(0); // identity rotation (w,x,y,z)
}

const outDir = join(process.cwd(), "public", "prism-mock", "splat");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "sample-torus.ply");
writeFileSync(out, Buffer.concat([Buffer.from(header, "ascii"), buf]));
console.log(`OK ${out} (${N} gaussians, ${buf.length + header.length} bytes)`);

// P1 TEXT SYSTEM (B4) — local procedural texture fills (criterion 28 groundwork).
//
// These are TEXTURE fills: 256×256 pigment tiles baked to PNG data URLs and
// poured into the MSDF glyph coverage by createMsdfNodeMaterial's texture
// path (the coverage is ALWAYS the alpha mask). No code here ever draws a
// letterform — INV-11 holds by construction.
//
// DETERMINISTIC by contract: every random decision flows from a mulberry32
// PRNG seeded by hashing `<prompt>::<style>::<index>` — no Math.random, no
// Date, no unseeded state. Same prompt ⇒ byte-identical suggestion array
// (within one browser engine; toDataURL's PNG encoder is engine-stable).
//
// This file lives under src/components/** so DOM canvas IS allowed (unlike
// src/lib/prism/**). Verified by scripts/verify-procedural-fills.mjs in real
// headless Chromium (vitest's node env has no canvas).

import { createNoise4D } from 'simplex-noise';
import type { TextFillSuggestion } from '@/lib/prism/text/contract';
import { DS } from '@/components/editor/design-system/tokens';

const TILE_SIZE = 256;

type Rng = () => number;

// xmur3 string hash → 32-bit seed (deterministic, well-mixed).
function hashPrompt(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise: seeded lattice + smoothstep bilinear, wrapping at the
// grid edge so the 256² tile repeats cleanly over the text block's aBlockUv.
function makeValueNoise(rng: Rng, grid: number): (u: number, v: number) => number {
  const lattice = new Float32Array(grid * grid);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
  return (u, v) => {
    const fx = (u - Math.floor(u)) * grid;
    const fy = (v - Math.floor(v)) * grid;
    const x0 = Math.floor(fx) % grid;
    const y0 = Math.floor(fy) % grid;
    const x1 = (x0 + 1) % grid;
    const y1 = (y0 + 1) % grid;
    let tx = fx - Math.floor(fx);
    let ty = fy - Math.floor(fy);
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = lattice[y0 * grid + x0] + (lattice[y0 * grid + x1] - lattice[y0 * grid + x0]) * tx;
    const b = lattice[y1 * grid + x0] + (lattice[y1 * grid + x1] - lattice[y1 * grid + x0]) * tx;
    return a + (b - a) * ty;
  };
}

// 3-octave fBm — UI-WOW-2 P3: simplex gradients (resurrects the installed-but-
// dead `simplex-noise` dep) for richer, more organic pigment than the value-
// noise lattice. Kept TILEABLE by sampling 4D simplex on a torus (u,v → two
// circles), so the 256² tile still repeats seamlessly over the text block's
// aBlockUv. Deterministic: the same seeded PRNG drives simplex's permutation,
// so identical prompt ⇒ stable output (no Math.random / Date).
function makeFbm(rng: Rng): (u: number, v: number) => number {
  const n = createNoise4D(rng);
  const TAU = Math.PI * 2;
  const R = 1 / TAU;
  return (u, v) => {
    const ux = Math.cos(u * TAU) * R;
    const uy = Math.sin(u * TAU) * R;
    const vx = Math.cos(v * TAU) * R;
    const vy = Math.sin(v * TAU) * R;
    let amp = 0.55;
    let freq = 5;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < 3; o++) {
      sum += amp * n(ux * freq, uy * freq, vx * freq, vy * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return Math.min(1, Math.max(0, (sum / norm) * 0.5 + 0.5));
  };
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// Piecewise-linear color ramp over [position, hex] stops (positions ascending).
function makeRamp(stops: Array<[number, string]>): (t: number) => Rgb {
  const rgb = stops.map(([p, hex]) => [p, ...hexToRgb(hex)] as [number, number, number, number]);
  return (t) => {
    const x = Math.min(1, Math.max(0, t));
    let i = 0;
    while (i < rgb.length - 2 && x > rgb[i + 1][0]) i++;
    const [p0, r0, g0, b0] = rgb[i];
    const [p1, r1, g1, b1] = rgb[i + 1];
    const f = p1 > p0 ? (x - p0) / (p1 - p0) : 0;
    const k = Math.min(1, Math.max(0, f));
    return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k];
  };
}

type PaintFn = (px: Uint8ClampedArray, size: number, rng: Rng) => void;

function paintRamped(
  px: Uint8ClampedArray,
  size: number,
  field: (u: number, v: number) => number,
  ramp: (t: number) => Rgb,
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = ramp(field(x / size, y / size));
      const o = (y * size + x) * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = 255;
    }
  }
}

// ── Style painters (all pigment fields; never glyph shapes) ─────────────────

const paintMolten: PaintFn = (px, size, rng) => {
  const fbm = makeFbm(rng);
  const ramp = makeRamp([
    [0, '#160302'],
    [0.4, '#6e1a05'],
    [0.68, '#e2620e'],
    [0.88, '#ffd23e'],
    [1, '#fff6cf'],
  ]);
  // Squaring biases toward dark crust with bright molten cracks.
  paintRamped(px, size, (u, v) => {
    const t = fbm(u, v);
    return t * t * 1.6;
  }, ramp);
};

const paintGold: PaintFn = (px, size, rng) => {
  const warp = makeFbm(rng);
  const bands = 2 + Math.floor(rng() * 3);
  const ramp = makeRamp([
    [0, '#3a2407'],
    [0.45, DS.brass600],
    [0.75, DS.brass400],
    [0.92, DS.brass200],
    [1, DS.brass100],
  ]);
  // Brushed-metal sheen: low-frequency diagonal bands warped by fBm.
  paintRamped(px, size, (u, v) => {
    const s = 0.5 + 0.5 * Math.sin((v * bands + u * 0.35 + warp(u, v) * 0.8) * Math.PI * 2);
    return s * 0.75 + warp(u * 3, v) * 0.25;
  }, ramp);
};

const paintChrome: PaintFn = (px, size, rng) => {
  const warp = makeFbm(rng);
  const horizon = 0.42 + rng() * 0.16;
  const ramp = makeRamp([
    [0, '#10131a'],
    [0.35, '#3c4452'],
    [0.55, '#c9d3de'],
    [0.75, '#7d8b9c'],
    [1, '#f2f6fa'],
  ]);
  // Classic chrome: mirrored sky/ground split across a warbling horizon.
  paintRamped(px, size, (u, v) => {
    const h = horizon + (warp(u, v) - 0.5) * 0.18;
    const d = v - h;
    return d < 0 ? 0.55 + d * 1.4 : 0.55 + Math.min(0.45, d * 2.2);
  }, ramp);
};

const paintOrganic: PaintFn = (px, size, rng) => {
  const clump = makeFbm(rng);
  const fiber = makeValueNoise(rng, 53);
  const ramp = makeRamp([
    [0, '#0f1c0b'],
    [0.35, '#2c4216'],
    [0.62, '#4f6f23'],
    [0.85, '#85a23e'],
    [1, '#c2cf8a'],
  ]);
  // Clumpy growth modulated by high-frequency fibers ("hairy" strands).
  paintRamped(px, size, (u, v) => clump(u, v) * 0.78 + fiber(u, v * 4) * 0.22, ramp);
};

const paintNeon: PaintFn = (px, size, rng) => {
  const bg = hexToRgb('#070210');
  const palette: Rgb[] = [
    hexToRgb('#27e9f6'),
    hexToRgb('#ff3d9a'),
    hexToRgb('#9d5cff'),
    hexToRgb('#3dff88'),
  ];
  const glowA = palette[Math.floor(rng() * palette.length)];
  const glowB = palette[Math.floor(rng() * palette.length)];
  const streaks = Array.from({ length: 3 }, () => ({
    base: rng(),
    amp: 0.05 + rng() * 0.12,
    freq: 1 + Math.floor(rng() * 3),
    phase: rng() * Math.PI * 2,
  }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let [r, g, b] = bg;
      // Additive exponential falloff around each sine streak.
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];
        const cy = s.base + Math.sin((u * s.freq + s.phase / (Math.PI * 2)) * Math.PI * 2) * s.amp;
        const glow = Math.exp(-Math.abs(v - cy) * 26);
        const c = i % 2 === 0 ? glowA : glowB;
        r += c[0] * glow;
        g += c[1] * glow;
        b += c[2] * glow;
      }
      const o = (y * size + x) * 4;
      px[o] = Math.min(255, r);
      px[o + 1] = Math.min(255, g);
      px[o + 2] = Math.min(255, b);
      px[o + 3] = 255;
    }
  }
};

const paintMarble: PaintFn = (px, size, rng) => {
  const warp = makeFbm(rng);
  const freq = 2 + Math.floor(rng() * 3);
  const angle = rng() * Math.PI;
  const ramp = makeRamp([
    [0, '#474c56'],
    [0.25, '#9b9da2'],
    [0.6, '#dcd9d2'],
    [1, '#efece5'],
  ]);
  // Domain-warped sine veins: thin dark seams through a light stone base.
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  paintRamped(px, size, (u, v) => {
    const w = (u * dx + v * dy) * freq + warp(u, v) * 2.2;
    return Math.pow(Math.abs(Math.sin(w * Math.PI)), 0.35);
  }, ramp);
};

// Fallback: duotone gradient in DS-adjacent hues (Observatory Brass / ice).
const DUOTONE_PAIRS: Array<[string, string]> = [
  [DS.brass600, DS.brass100],
  [DS.ice500, DS.ice200],
  [DS.brass500, DS.ice300],
  [DS.ice400, DS.brass200],
  [DS.graphite, DS.brass300],
];

const paintDuotone: PaintFn = (px, size, rng) => {
  const [fromHex, toHex] = DUOTONE_PAIRS[Math.floor(rng() * DUOTONE_PAIRS.length)];
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const angle = rng() * Math.PI * 2;
  const dither = makeValueNoise(rng, 31);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Projection along the seeded angle, re-biased 0..1 + light dither.
      const t = Math.min(1, Math.max(0,
        (u - 0.5) * dx + (v - 0.5) * dy + 0.5 + (dither(u, v) - 0.5) * 0.08,
      ));
      const o = (y * size + x) * 4;
      px[o] = from[0] + (to[0] - from[0]) * t;
      px[o + 1] = from[1] + (to[1] - from[1]) * t;
      px[o + 2] = from[2] + (to[2] - from[2]) * t;
      px[o + 3] = 255;
    }
  }
};

// ── Prompt → style resolution (first keyword hit wins; honest labels) ───────

interface FillStyle {
  id: string;
  label: string;
  keywords: string[];
  paint: PaintFn;
}

const STYLES: FillStyle[] = [
  {
    id: 'molten',
    label: 'Molten Metal',
    keywords: ['molten', 'lava', 'magma', 'fire', 'ember', 'heat', 'inferno'],
    paint: paintMolten,
  },
  {
    id: 'gold',
    label: 'Brushed Gold',
    keywords: ['gold', 'golden', 'brass', 'bronze', 'copper'],
    paint: paintGold,
  },
  {
    id: 'chrome',
    label: 'Chrome',
    keywords: ['chrome', 'silver', 'steel', 'metal', 'mercury', 'iron'],
    paint: paintChrome,
  },
  {
    id: 'organic',
    label: 'Organic Moss',
    keywords: ['moss', 'fur', 'hairy', 'organic', 'grass', 'lichen', 'forest'],
    paint: paintOrganic,
  },
  {
    id: 'neon',
    label: 'Neon Glow',
    keywords: ['neon', 'glow', 'cyber', 'electric', 'plasma', 'laser', 'synthwave'],
    paint: paintNeon,
  },
  {
    id: 'marble',
    label: 'Marble Veins',
    keywords: ['marble', 'stone', 'granite', 'vein', 'quartz', 'onyx'],
    paint: paintMarble,
  },
];

const FALLBACK_STYLE: FillStyle = {
  id: 'duotone',
  label: 'Duotone Gradient',
  keywords: [],
  paint: paintDuotone,
};

function resolveStyle(prompt: string): FillStyle {
  const p = prompt.toLowerCase();
  return STYLES.find((s) => s.keywords.some((k) => p.includes(k))) ?? FALLBACK_STYLE;
}

function bakeTile(paint: PaintFn, rng: Rng): string {
  const px = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
  paint(px, TILE_SIZE, rng);
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('procedural-fills: 2d canvas context unavailable');
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  img.data.set(px);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Bake `count` distinct procedural pigment tiles for `prompt`. Pure function
 *  of the prompt (seeded PRNG per tile) — identical calls return identical
 *  arrays. Source is always 'procedural-local'; labels say so honestly. */
export function generateProceduralFills(prompt: string, count = 5): TextFillSuggestion[] {
  const style = resolveStyle(prompt);
  const key = prompt.trim().toLowerCase();
  const out: TextFillSuggestion[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(hashPrompt(`${key}::${style.id}::${i}`));
    out.push({
      label: `Procedural — ${style.label} #${i + 1}`,
      url: bakeTile(style.paint, rng),
      source: 'procedural-local',
    });
  }
  return out;
}

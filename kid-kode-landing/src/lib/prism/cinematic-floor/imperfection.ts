// CINEMATIC-FLOOR — procedural imperfection map (W-PHOTO D4).
//
// Perfection reads digital. Real surfaces carry dust, micro-scratches, and
// fingerprint smudges that break up specular highlights into something the eye
// trusts. This builds a deterministic grayscale imperfection texture (dust
// specks + fine scratches + low-frequency smudge) usable as a roughness/detail
// breakup on a node's material — a NODE-LOCAL R1 floor piece (DEV-2), consumed
// by the atelier factory (D6) and the `imperfection-veil` catalog primitive.
//
// Deterministic (seeded PRNG, no Math.random) so the map is byte-stable and
// seek()/verify stay reproducible. Browser-safe three (DataTexture); no DOM.

import {
  DataTexture,
  LinearFilter,
  RGBAFormat,
  RepeatWrapping,
  type Texture,
} from "three";

/** mulberry32 — tiny deterministic PRNG so imperfection maps are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ImperfectionOptions {
  size?: number;
  seed?: number;
  /** Number of dust specks. */
  dust?: number;
  /** Number of fine scratches. */
  scratches?: number;
  /** 0..1 overall strength of the breakup around the neutral value. */
  strength?: number;
  /**
   * Neutral value the map is centred on (default 0.5). Set ~0.9 when used as a
   * `roughnessMap` (which MULTIPLIES base roughness) so the surface's roughness
   * is mostly preserved with only a subtle imperfection breakup around it.
   */
  center?: number;
}

/** Compute the raw imperfection field (±deviation around 0), shared by both
 * the roughness-map and transparent-overlay encoders. */
function computeImperfectionField(opts: ImperfectionOptions): {
  field: Float32Array;
  size: number;
} {
  const size = opts.size ?? 512;
  const rand = rng(opts.seed ?? 1337);
  const dust = opts.dust ?? Math.round((size * size) / 900);
  const scratches = opts.scratches ?? 26;

  // Base field: low-frequency smudge (value noise via a few sine octaves).
  const field = new Float32Array(size * size);
  const oct = [
    { f: 2.1, a: 0.5, px: rand() * 6.28, py: rand() * 6.28 },
    { f: 5.3, a: 0.3, px: rand() * 6.28, py: rand() * 6.28 },
    { f: 11.7, a: 0.2, px: rand() * 6.28, py: rand() * 6.28 },
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let n = 0;
      for (const o of oct)
        n +=
          Math.sin(u * o.f * 6.283 + o.px) *
          Math.cos(v * o.f * 6.283 + o.py) *
          o.a;
      field[y * size + x] = n * 0.12; // subtle smudge, ±0.12
    }
  }

  // Dust specks: small round darkenings/brightenings.
  for (let i = 0; i < dust; i++) {
    const cx = Math.floor(rand() * size);
    const cy = Math.floor(rand() * size);
    const r = 1 + Math.floor(rand() * 2.5);
    const sign = rand() < 0.7 ? -1 : 1; // mostly darkening dust
    const mag = (0.25 + rand() * 0.4) * sign;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.sqrt(dx * dx + dy * dy) / (r + 0.5);
        if (d > 1) continue;
        field[y * size + x] += mag * (1 - d) * (1 - d);
      }
    }
  }

  // Fine scratches: thin bright lines at random angles.
  for (let i = 0; i < scratches; i++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const ang = rand() * Math.PI;
    const len = 20 + rand() * (size * 0.35);
    const mag = 0.18 + rand() * 0.25;
    const steps = Math.ceil(len);
    for (let s = 0; s < steps; s++) {
      const x = Math.round(x0 + Math.cos(ang) * s);
      const y = Math.round(y0 + Math.sin(ang) * s);
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      field[y * size + x] += mag * (0.4 + 0.6 * (1 - s / steps));
    }
  }

  return { field, size };
}

function finishTexture(data: Uint8Array, size: number): DataTexture {
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build a grayscale imperfection map. Neutral value is 0.5; dust darkens/
 * brightens local specks, scratches draw thin bright lines, and a low-frequency
 * smudge field adds broad unevenness. Feed as a material's roughnessMap (see
 * applyImperfection) — the R1 NODE-LOCAL floor piece for the atelier (D6).
 */
export function makeImperfectionMap(
  opts: ImperfectionOptions = {},
): DataTexture {
  const { field, size } = computeImperfectionField(opts);
  const strength = opts.strength ?? 1;
  const center = opts.center ?? 0.5;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const g = Math.round(
      Math.max(0, Math.min(1, center + field[i] * strength)) * 255,
    );
    data[i * 4] = g;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = g;
    data[i * 4 + 3] = 255;
  }
  return finishTexture(data, size);
}

/**
 * Build a TRANSPARENT overlay imperfection texture: neutral areas are fully
 * transparent (no-op), dust reads as dark specks, scratches as faint bright
 * lines — alpha encodes strength. Composite over ANY subject (normal blend) to
 * add believable grime; drives the `imperfection-veil` catalog primitive.
 */
export function makeImperfectionOverlay(
  opts: ImperfectionOptions = {},
): DataTexture {
  const { field, size } = computeImperfectionField(opts);
  const strength = opts.strength ?? 1;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const dev = field[i] * strength; // + = bright scratch, − = dark dust
    const a = Math.min(1, Math.abs(dev) * 2.2);
    const c = dev >= 0 ? 235 : 10; // bright vs near-black speck
    data[i * 4] = c;
    data[i * 4 + 1] = c;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = Math.round(a * 255);
  }
  return finishTexture(data, size);
}

/**
 * Apply an imperfection map to a material's roughness as a subtle detail break.
 * Works on any three material exposing `roughnessMap` (Standard/Physical, node
 * or classic). `amount` scales how much the map perturbs roughness.
 */
export function applyImperfection(
  material: {
    roughnessMap?: Texture | null;
    roughness?: number;
    needsUpdate?: boolean;
  },
  map: Texture,
  amount = 0.5,
): void {
  material.roughnessMap = map;
  if (typeof material.roughness === "number") {
    // Keep the base roughness mid so the map has headroom both ways.
    material.roughness = Math.max(
      0.15,
      Math.min(0.95, material.roughness * (1 - amount * 0.2) + 0.1 * amount),
    );
  }
  material.needsUpdate = true;
}
